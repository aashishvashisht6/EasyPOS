import frappe
from frappe.utils import now_datetime

from easy_pos.api.item import get_item_groups, get_items
from easy_pos.api.pos import get_taxes_and_charges_template

CUSTOMER_FIELDS = ["name", "customer_name", "customer_group", "territory", "mobile_no", "email_id", "disabled"]
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

# Caps how many Customer rows a single snapshot carries — offline browsing only
# needs "recently relevant" customers, not a company's entire multi-year history,
# and an unbounded fetch would make every full sync progressively slower to run.
MAX_CACHED_CUSTOMERS = 2000


@frappe.whitelist()
def get_offline_snapshot(pos_profile: str) -> dict:
	"""One-shot master-data bundle for `posapp/src/engine/sync.js`'s runFullSync to cache into
	Dexie — covers exactly the doctypes engine/index.js treats as offline-capable (Item, Item
	Group, Customer, Price List, Pricing Rule, Sales Taxes and Charges Template, POS Profile,
	Mode of Payment).

	Deliberately reuses the *existing* resolution helpers (get_items, get_taxes_and_charges_template)
	instead of re-deriving stock/rate/tax logic here or in JS — the cached item rows are exactly what
	the terminal would already see live, for this profile's own warehouse/price list. The one
	simplification: resolution runs with no `customer` (a customer-specific Item Price row or
	Pricing Rule only ever applies once one is picked in the cart, at which point the terminal
	needs the server anyway) — a cached item's rate is the generic, non-customer price.
	"""
	profile = frappe.get_doc("POS Profile", pos_profile)

	items = get_items(warehouse=profile.warehouse, price_list=profile.selling_price_list, pos_profile=pos_profile)
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
	}
