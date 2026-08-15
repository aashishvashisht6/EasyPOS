import frappe
from frappe.utils import now_datetime

from easy_pos.api.item import get_item_groups, get_items
from easy_pos.api.pos import _finalize_invoice, _save_sales_invoice, get_taxes_and_charges_template

CUSTOMER_FIELDS = [
	"name",
	"customer_name",
	"customer_group",
	"territory",
	"mobile_no",
	"email_id",
	"disabled",
]
PRICE_LIST_FIELDS = ["name", "price_list_name", "currency", "buying", "selling", "enabled"]
PRICING_RULE_FIELDS = [
	"name",
	"title",
	"apply_on",
	"price_or_product_discount",
	"rate_or_discount",
	"discount_percentage",
	"discount_amount",
	"selling",
	"buying",
	"priority",
	"disable",
	"valid_from",
	"valid_upto",
]
# Mirrors posapp/src/api/POSProfile.js's PROFILE_FIELDS (POS Profile list page columns).
POS_PROFILE_LIST_FIELDS = ["name", "company", "warehouse", "selling_price_list", "disabled"]
# Mirrors posapp/src/api/ItemPrice.js's ITEM_PRICE_FIELDS.
ITEM_PRICE_FIELDS = [
	"name",
	"item_code",
	"item_name",
	"price_list",
	"price_list_rate",
	"currency",
	"uom",
	"selling",
	"buying",
	"valid_from",
	"valid_upto",
]
# Mirrors posapp/src/api/LoyaltyProgram.js's LOYALTY_PROGRAM_FIELDS.
LOYALTY_PROGRAM_FIELDS = [
	"name",
	"loyalty_program_name",
	"loyalty_program_type",
	"from_date",
	"to_date",
	"customer_group",
	"customer_territory",
	"conversion_factor",
	"company",
]
# Mirrors posapp/src/api/InvoiceRegister.js's INVOICE_FIELDS, plus `is_pos` —
# fetchInvoices always filters on is_pos=1, so the cached rows need the field
# even though the list page itself never displays it.
INVOICE_FIELDS = [
	"name",
	"posting_date",
	"customer",
	"customer_name",
	"grand_total",
	"status",
	"docstatus",
	"pos_profile",
	"is_pos",
]

# Caps how many Customer/Item Price/Sales Invoice rows a single snapshot carries —
# offline browsing only needs "recently relevant" records, not a company's entire
# multi-year history, and an unbounded fetch would make every full sync
# progressively slower to run.
MAX_CACHED_CUSTOMERS = 2000
MAX_CACHED_ITEM_PRICES = 5000
# Invoices are scoped to this profile's own shift history (unlike the other
# domains, which are company-wide) — a cashier only ever needs their own
# terminal's recent invoices available offline, not every profile's.
MAX_CACHED_INVOICES = 500


@frappe.whitelist()
def get_offline_snapshot(pos_profile: str) -> dict:
	"""One-shot master-data bundle for `posapp/src/engine/sync.js`'s runFullSync to cache into
	Dexie — covers exactly the doctypes engine/index.js treats as offline-capable (Item, Item
	Group, Customer, Price List, Pricing Rule, Sales Taxes and Charges Template, POS Profile,
	Mode of Payment, Item Price, Loyalty Program, Sales Invoice).

	Deliberately reuses the *existing* resolution helpers (get_items, get_taxes_and_charges_template)
	instead of re-deriving stock/rate/tax logic here or in JS — the cached item rows are exactly what
	the terminal would already see live, for this profile's own warehouse/price list. The one
	simplification: resolution runs with no `customer` (a customer-specific Item Price row or
	Pricing Rule only ever applies once one is picked in the cart, at which point the terminal
	needs the server anyway) — a cached item's rate is the generic, non-customer price.
	"""
	profile = frappe.get_doc("POS Profile", pos_profile)

	items = get_items(
		warehouse=profile.warehouse, price_list=profile.selling_price_list, pos_profile=pos_profile
	)
	item_groups = get_item_groups()
	tax_rows = get_taxes_and_charges_template(profile.taxes_and_charges)

	customers = frappe.get_all(
		"Customer",
		filters={"disabled": 0},
		fields=CUSTOMER_FIELDS,
		order_by="modified desc",
		limit_page_length=MAX_CACHED_CUSTOMERS,
	)
	price_lists = frappe.get_all("Price List", fields=PRICE_LIST_FIELDS)
	pricing_rules = frappe.get_all("Pricing Rule", fields=PRICING_RULE_FIELDS)
	modes_of_payment = frappe.get_all("Mode of Payment", fields=["name", "type", "enabled"])

	# Company-wide, for the POS Profile list page — separate from `pos_profile`
	# below (this profile's own full doc, used for the currently-open shift).
	pos_profiles = frappe.get_all("POS Profile", fields=POS_PROFILE_LIST_FIELDS, order_by="name asc")
	item_prices = frappe.get_all(
		"Item Price",
		fields=ITEM_PRICE_FIELDS,
		order_by="modified desc",
		limit_page_length=MAX_CACHED_ITEM_PRICES,
	)
	loyalty_programs = frappe.get_all(
		"Loyalty Program", fields=LOYALTY_PROGRAM_FIELDS, order_by="loyalty_program_name asc"
	)
	invoices = frappe.get_all(
		"Sales Invoice",
		filters={"is_pos": 1, "pos_profile": pos_profile},
		fields=INVOICE_FIELDS,
		order_by="posting_date desc, creation desc",
		limit_page_length=MAX_CACHED_INVOICES,
	)

	return {
		"synced_at": now_datetime().isoformat(),
		"pos_profile": profile.as_dict(),
		"items": items,
		"item_groups": item_groups,
		"customers": customers,
		"price_lists": price_lists,
		"pricing_rules": pricing_rules,
		"taxes": {"template": profile.taxes_and_charges, "rows": tax_rows},
		"modes_of_payment": modes_of_payment,
		"pos_profiles": pos_profiles,
		"item_prices": item_prices,
		"loyalty_programs": loyalty_programs,
		"invoices": invoices,
	}


@frappe.whitelist()
def push_offline_invoice(
	offline_id: str, invoice: dict, opening_details: dict, submit: bool, coupon_code: str | None = None
) -> dict:
	"""Replays a single Sales Invoice queued by the POS Terminal's offline write
	queue (posapp/src/engine/outbox.js's pushPendingInvoices) against ERPNext,
	once connectivity is back — same invoice/opening_details/submit/coupon_code
	shape create_invoice takes, plus the client-generated offline_id.

	Idempotent: if a Sales Invoice with this ep_offline_id already exists (e.g. a
	prior push actually succeeded but the response was lost to a connectivity
	drop before the client could mark the row synced), that doc is returned
	as-is instead of inserting a duplicate — the frontend always treats the
	returned name as authoritative regardless of which branch ran.
	"""
	existing_name = frappe.db.exists("Sales Invoice", {"ep_offline_id": offline_id})
	if existing_name:
		return frappe.get_doc("Sales Invoice", existing_name).as_dict()

	try:
		sales_invoice, pos_profile = _save_sales_invoice(invoice, opening_details, ep_offline_id=offline_id)
	except frappe.UniqueValidationError:
		# The exists-check above isn't atomic with the insert below — two
		# concurrent pushes of the same offline_id (e.g. the reconnect-triggered
		# auto-push racing a manual "Push now" click from a second tab/window)
		# can both pass it before either commits, so the loser hits the DB's
		# own unique constraint on ep_offline_id instead. That means the winner
		# already created the real invoice, so fetch and return it exactly like
		# the idempotent branch above rather than surfacing a spurious failure.
		existing_name = frappe.db.exists("Sales Invoice", {"ep_offline_id": offline_id})
		if existing_name:
			return frappe.get_doc("Sales Invoice", existing_name).as_dict()
		raise

	if submit:
		_finalize_invoice(sales_invoice, pos_profile, coupon_code)

	return sales_invoice.as_dict()
