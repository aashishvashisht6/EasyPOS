import frappe

from easy_pos.api.loyalty import _get_customer_loyalty_summary


@frappe.whitelist()
def get_customer_with_loyalty(name: str, company: str | None = None) -> dict:
	"""Customer doc + its live Loyalty Program summary in a single round trip.

	Cart/index.jsx used to fire two separate calls when a cashier picked a
	customer — a plain `frappe.client.get` (to learn customer_group/territory,
	needed by the client-side pricing engine's applicable_for matching) and
	`easy_pos.api.loyalty.get_customer_loyalty_summary` — one right after the
	other. Folding the loyalty summary onto the customer doc here removes that
	second call entirely: everything the Terminal needs about a customer now
	resolves from one request."""
	if not name:
		return {}

	customer = frappe.get_doc("Customer", name).as_dict()
	summary = _get_customer_loyalty_summary(name, company)

	customer["loyalty_points"] = summary.get("loyalty_points") or 0
	customer["loyalty_conversion_factor"] = summary.get("conversion_factor") or 0
	customer["loyalty_tier_name"] = summary.get("tier_name")
	# summary["loyalty_program"], when set, is always customer.loyalty_program
	# itself (see _get_customer_loyalty_summary) — not duplicated here.
	return customer
