import json

import frappe
from frappe.utils import cint, flt, nowdate

from easy_pos.api.pos import get_currency_precision


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
def validate_coupon(coupon_code):
    """Standalone check for the Cart's coupon-code input — resolves + validates
    (active window, usage cap) without needing a cart to price yet."""
    from erpnext.accounts.doctype.pricing_rule.utils import validate_coupon_code

    name = _coupon_code_name(coupon_code)
    if not name:
        frappe.throw("Invalid coupon code")
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


@frappe.whitelist()
def get_cart_pricing(items, pos_profile, customer=None, coupon_code=None):
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

    coupon_name = None
    if coupon_code:
        from erpnext.accounts.doctype.pricing_rule.utils import validate_coupon_code

        coupon_name = _coupon_code_name(coupon_code)
        if not coupon_name:
            frappe.throw("Invalid coupon code")
        validate_coupon_code(coupon_name)

    from erpnext.stock.get_item_details import get_item_details

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
            "currency": profile.currency,
            "conversion_rate": 1,
            "plc_conversion_rate": 1,
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
            details = get_item_details(args)
        except Exception:
            frappe.log_error(title="easy_pos.api.pricing.get_cart_pricing")
            details = frappe._dict()
            entry["error"] = "Could not resolve pricing rules for this item"

        price_list_rate = flt(details.get("price_list_rate"))
        if not price_list_rate:
            # get_item_details doesn't fall back to Item.standard_rate on its
            # own (only to a different Selling Settings price list) — same
            # fallback as easy_pos.api.item._get_rate_map for the item grid.
            price_list_rate = flt(frappe.get_cached_value("Item", item_code, "standard_rate"))

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
