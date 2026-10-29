import json

import frappe
from frappe import _
from frappe.utils import cint, flt, getdate, nowdate

from easy_pos.api.currency import get_profile_currency, get_profile_currency_context
from easy_pos.api.pos import get_currency_precision

# Fields client-side matching (posapp/src/utils/pricingEngine.js) actually
# needs — a subset of Pricing Rule's own field list, see get_pricing_rules.
PRICING_RULE_ENGINE_FIELDS = [
	"name",
	"title",
	"apply_on",
	"price_or_product_discount",
	"rate_or_discount",
	"rate",
	"discount_percentage",
	"discount_amount",
	"apply_discount_on_rate",
	"applicable_for",
	"customer",
	"customer_group",
	"territory",
	"company",
	"min_qty",
	"max_qty",
	"min_amt",
	"max_amt",
	"valid_from",
	"valid_upto",
	"priority",
	"apply_multiple_pricing_rules",
	"for_price_list",
	"currency",
	"coupon_code_based",
	# Product Discount (free item) fields
	"free_item",
	"free_qty",
	"free_item_rate",
	"same_item",
	"is_recursive",
	"apply_recursion_over",
	"recurse_for",
	"round_free_qty",
	# Features the local engine does not model. A rule using any of them is
	# flagged `needs_server` in get_pricing_rules so the Cart defers to
	# get_cart_pricing (or warns offline) instead of silently mispricing.
	"mixed_conditions",
	"is_cumulative",
	"apply_rule_on_other",
	"condition",
	"margin_rate_or_amount",
]


class _CartDoc(frappe._dict):
	def as_dict(self):
		return self


def _coupon_code_name(coupon_code):
	"""A cashier types the human `coupon_code` value (Coupon Code doc's own
	`coupon_code` field), but erpnext.accounts.doctype.pricing_rule.pricing_rule
	matches against the Coupon Code *document name* — resolve one to the other,
	accepting either."""
	if not coupon_code:
		return None
	if frappe.db.exists("Coupon Code", coupon_code):
		return coupon_code
	return frappe.db.get_value("Coupon Code", {"coupon_code": coupon_code}, "name")


@frappe.whitelist()
def validate_coupon(coupon_code: str) -> dict:
	"""Standalone check for the Cart's coupon-code input — resolves + validates
	(active window, usage cap) without needing a cart to price yet."""
	from erpnext.accounts.doctype.pricing_rule.utils import validate_coupon_code

	name = _coupon_code_name(coupon_code)
	if not name:
		frappe.throw(_("Invalid coupon code"))
	validate_coupon_code(name)
	return {"name": name}


def _effective_rate(price_list_rate, discount_percentage, discount_amount, precision):
	"""Same formula ERPNext's own controller uses to turn a Pricing Rule's
	discount into a line rate (erpnext.controllers.taxes_and_totals.calculate_item_values)."""
	price_list_rate = flt(price_list_rate)
	if discount_percentage == 100:
		return 0.0, price_list_rate
	if discount_percentage:
		rate = flt(price_list_rate * (1 - discount_percentage / 100), precision)
		discount_amount = flt(price_list_rate - rate, precision)
		return rate, discount_amount
	if discount_amount:
		rate = flt(price_list_rate - discount_amount, precision)
		return rate, flt(discount_amount, precision)
	return price_list_rate, 0.0


def _descendants(doctype, names):
	"""`names` plus every descendant in the `doctype` tree (lft/rgt nested set).

	ERPNext matches a rule scoped to a group against an item/customer sitting
	anywhere underneath it (pricing_rule.utils._get_tree_conditions), so the
	client — which only does exact lookups — gets the expanded list."""
	out = set()
	for name in names:
		lft, rgt = frappe.db.get_value(doctype, name, ["lft", "rgt"]) or (None, None)
		if lft is None:
			out.add(name)
			continue
		out.update(frappe.get_all(doctype, filters={"lft": [">=", lft], "rgt": ["<=", rgt]}, pluck="name"))
	return sorted(out)


@frappe.whitelist()
def get_pricing_rules(pos_profile: str) -> list:
	"""Snapshot of this profile's Selling Pricing Rules, fetched once at
	shift-open (posSessionStore.loadProfileDetails) so the Cart's client-side
	pricing engine (posapp/src/utils/pricingEngine.js) can resolve every
	add-to-cart locally — including when the till is offline — instead of
	round-tripping to get_cart_pricing.

	Mirrors what erpnext.accounts.doctype.pricing_rule.utils.get_pricing_rules
	would consider: Item Code / Item Group / Brand scoped rules, rules with a
	blank company, and coupon-based rules (their Coupon Code rows ride along
	as `coupon_codes`). Group scoping is pre-expanded to the whole subtree
	(`item_groups`, `customer_group_tree`, `territory_tree`) so the client
	needs only exact lookups.

	Rules using features the local engine can't evaluate (mixed conditions,
	cumulative, apply_rule_on_other, a Python `condition`, margins, a UOM
	restriction) are still returned, flagged `needs_server`, so the Cart knows
	a line they match can't be priced locally.
	"""
	profile = frappe.get_cached_doc("POS Profile", pos_profile)
	today = getdate(nowdate())
	invoice_currency = get_profile_currency(pos_profile)

	rules = frappe.get_all(
		"Pricing Rule",
		filters={"selling": 1, "disable": 0, "apply_on": ["in", ["Item Code", "Item Group", "Brand"]]},
		fields=PRICING_RULE_ENGINE_FIELDS,
	)
	rules = [
		r
		for r in rules
		if (not r.company or r.company == profile.company)
		and (not r.valid_from or getdate(r.valid_from) <= today)
		and (not r.valid_upto or getdate(r.valid_upto) >= today)
		and (not r.for_price_list or r.for_price_list == profile.selling_price_list)
	]
	rule_names = [r.name for r in rules]

	# A rule row pinned to a UOM other than the item's stock UOM scales its
	# min/max qty by the conversion factor (filter_pricing_rules_for_qty_amount);
	# the Cart only sells in stock UOM, so a row whose UOM equals the item's
	# stock UOM (the UI fills "Nos" in by default) is harmless, anything else
	# needs the server.
	uom_restricted = set()

	def _children(doctype, field):
		out = {}
		for row in frappe.get_all(
			doctype, filters={"parent": ["in", rule_names]}, fields=["parent", field, "uom"]
		):
			out.setdefault(row.parent, []).append(row[field])
			if row.uom and (
				doctype != "Pricing Rule Item Code"
				or row.uom != frappe.get_cached_value("Item", row.item_code, "stock_uom")
			):
				uom_restricted.add(row.parent)
		return out

	items_by_rule = _children("Pricing Rule Item Code", "item_code")
	groups_by_rule = _children("Pricing Rule Item Group", "item_group")
	brands_by_rule = _children("Pricing Rule Brand", "brand")

	coupons_by_rule = {}
	for c in frappe.get_all(
		"Coupon Code",
		filters={"pricing_rule": ["in", rule_names]},
		fields=["name", "coupon_code", "pricing_rule", "valid_from", "valid_upto", "maximum_use", "used"],
	):
		coupons_by_rule.setdefault(c.pricing_rule, []).append(c)

	for r in rules:
		r["item_codes"] = items_by_rule.get(r.name, [])
		r["item_groups"] = _descendants("Item Group", groups_by_rule.get(r.name, []))
		r["brands"] = brands_by_rule.get(r.name, [])
		r["customer_group_tree"] = (
			_descendants("Customer Group", [r.customer_group]) if r.customer_group else []
		)
		r["territory_tree"] = _descendants("Territory", [r.territory]) if r.territory else []
		r["coupon_codes"] = coupons_by_rule.get(r.name, [])
		# ERPNext only honours a fixed "Rate" rule when the rule's currency is
		# the invoice's (pricing_rule.apply_price_discount_rule).
		r["currency_matches"] = (not r.currency) or r.currency == invoice_currency
		r["needs_server"] = bool(
			cint(r.mixed_conditions)
			or cint(r.is_cumulative)
			or r.apply_rule_on_other
			or r.condition
			or flt(r.margin_rate_or_amount)
			or r.name in uom_restricted
		)

	return rules


@frappe.whitelist()
def get_cart_pricing(
	items: list | str, pos_profile: str, customer: str | None = None, coupon_code: str | None = None
) -> dict:
	"""
	items: [{item_code, qty}, ...] — the current cart lines.

	Resolves rate/discount for every line through ERPNext's own Pricing Rule
	engine (erpnext.stock.get_item_details.get_item_details, the same call
	desk's Sales Invoice form makes on every item row) instead of
	re-implementing rule matching, priority/apply_multiple_pricing_rules
	stacking, or Product Discount (free item) logic — those are exactly the
	semantics a cashier already gets in desk POS.

	Only Item Code / Item Group / Brand scoped rules are evaluated per line;
	a `Transaction`-level Pricing Rule (apply_on = "Transaction", eg. a
	whole-order amount threshold) needs the full invoice total/line context
	that a per-item preview call doesn't have, so it's a known gap — flagged
	in docs/POS_PRICING_USE_CASES.md (PR-20) rather than silently mishandled.
	"""
	if isinstance(items, str):
		items = json.loads(items)

	profile = frappe.get_cached_doc("POS Profile", pos_profile)
	precision = get_currency_precision()
	currency_ctx = get_profile_currency_context(pos_profile)

	coupon_name = None
	if coupon_code:
		from erpnext.accounts.doctype.pricing_rule.utils import validate_coupon_code

		coupon_name = _coupon_code_name(coupon_code)
		if not coupon_name:
			frappe.throw(_("Invalid coupon code"))
		validate_coupon_code(coupon_name)

	from erpnext.accounts.doctype.pricing_rule.utils import MultiplePricingRuleConflict
	from erpnext.stock.get_item_details import get_item_details

	# Rules that look at the whole cart (recursive free items, conditions) need a
	# document with the other lines; get_item_details only takes one when called
	# from a real Sales Invoice form.
	cart_doc = _CartDoc(
		doctype="Sales Invoice",
		company=profile.company,
		# Without a date on the doc ERPNext drops the valid_from/valid_upto filter
		# and applies expired and not-yet-active rules.
		transaction_date=nowdate(),
		posting_date=nowdate(),
		items=[
			frappe._dict(
				item_code=r.get("item_code"),
				qty=flt(r.get("qty") or 1),
				stock_qty=flt(r.get("qty") or 1),
				is_free_item=0,
				pricing_rules=None,
			)
			for r in items
		],
	)

	results = []
	free_items = {}

	for row in items:
		item_code = row.get("item_code")
		qty = flt(row.get("qty") or 1)

		args = {
			"item_code": item_code,
			"customer": customer or None,
			"qty": qty,
			"company": profile.company,
			# get_item_details returns price_list_rate already converted into
			# the invoice currency from these, same as desk's Sales Invoice form.
			"currency": currency_ctx.currency,
			"conversion_rate": currency_ctx.conversion_rate,
			"price_list_currency": currency_ctx.price_list_currency,
			"plc_conversion_rate": currency_ctx.plc_conversion_rate,
			"price_list": profile.selling_price_list,
			"selling_price_list": profile.selling_price_list,
			"doctype": "Sales Invoice",
			"is_pos": 1,
			"pos_profile": pos_profile,
			"warehouse": profile.warehouse,
			"transaction_date": nowdate(),
			"ignore_pricing_rule": cint(profile.ignore_pricing_rule),
			"coupon_code": coupon_name,
		}

		entry = {"item_code": item_code, "qty": qty, "error": None}
		try:
			details = get_item_details(args, doc=cart_doc)
		except MultiplePricingRuleConflict as e:
			# Two rules tie on every criterion (ERPNext asks the admin to set a
			# priority). The line still has to be sellable: price it from the plain
			# price list with no rule applied and tell the cashier why.
			args["ignore_pricing_rule"] = 1
			details = get_item_details(args)
			entry["error"] = frappe.as_unicode(e)
		except Exception:
			frappe.log_error(title="easy_pos.api.pricing.get_cart_pricing")
			args["ignore_pricing_rule"] = 1
			try:
				details = get_item_details(args)
			except Exception:
				details = frappe._dict()
			entry["error"] = "Could not resolve pricing rules for this item"

		price_list_rate = flt(details.get("price_list_rate"))
		if not price_list_rate:
			# get_item_details doesn't fall back to Item.standard_rate on its
			# own (only to a different Selling Settings price list) — same
			# fallback as easy_pos.api.item._get_rate_map for the item grid.
			# standard_rate is in company currency.
			price_list_rate = (
				flt(frappe.get_cached_value("Item", item_code, "standard_rate"))
				/ currency_ctx.conversion_rate
			)

		rate, discount_amount = _effective_rate(
			price_list_rate,
			flt(details.get("discount_percentage")),
			flt(details.get("discount_amount")),
			precision,
		)

		entry.update(
			{
				"price_list_rate": flt(price_list_rate, precision),
				"rate": flt(rate, precision),
				"discount_percentage": flt(details.get("discount_percentage")),
				"discount_amount": discount_amount,
				"pricing_rules": json.loads(details.get("pricing_rules") or "[]"),
				"has_pricing_rule": bool(details.get("has_pricing_rule")),
			}
		)
		results.append(entry)

		for free in details.get("free_item_data") or []:
			key = (free.get("item_code"), free.get("pricing_rules"))
			free_items[key] = {
				"item_code": free.get("item_code"),
				"item_name": free.get("item_name"),
				"qty": flt(free.get("qty")),
				"rate": flt(free.get("rate")),
				"uom": free.get("uom"),
				"pricing_rules": free.get("pricing_rules"),
				"is_free_item": 1,
			}

	return {"items": results, "free_items": list(free_items.values())}
