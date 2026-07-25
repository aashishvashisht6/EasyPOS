import frappe


@frappe.whitelist()
def get_customer_loyalty_summary(customer: str, company: str = None) -> dict:
	"""Points balance + program terms for a customer, for the POS terminal's
	redeem-at-payment UI. ERPNext's own get_loyalty_program_details_with_points
	unconditionally does frappe.get_doc("Loyalty Program", loyalty_program) even
	when silent=True and the customer isn't enrolled (loyalty_program is None),
	which raises DoesNotExistError instead of returning quietly — so enrollment
	is checked here first and an empty dict returned rather than calling into it."""
	if not customer:
		return {}

	loyalty_program = frappe.db.get_value("Customer", customer, "loyalty_program")
	if not loyalty_program:
		return {}

	from erpnext.accounts.doctype.loyalty_program.loyalty_program import (
		get_loyalty_program_details_with_points,
	)

	details = get_loyalty_program_details_with_points(
		customer, loyalty_program=loyalty_program, company=company, silent=True
	)

	return {
		"loyalty_program": details.get("loyalty_program"),
		"loyalty_points": details.get("loyalty_points") or 0,
		"conversion_factor": details.get("conversion_factor") or 0,
		"tier_name": details.get("tier_name"),
	}
