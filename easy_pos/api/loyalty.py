import frappe


def _get_customer_loyalty_summary(customer: str, company: str | None = None) -> dict:
	"""Points balance + program terms for a customer. ERPNext's own
	get_loyalty_program_details_with_points unconditionally does
	frappe.get_doc("Loyalty Program", loyalty_program) even when silent=True and
	the customer isn't enrolled (loyalty_program is None), which raises
	DoesNotExistError instead of returning quietly — so enrollment is checked
	here first and an empty dict returned rather than calling into it.

	Non-whitelisted helper shared by the standalone `get_customer_loyalty_summary`
	endpoint (kept for any other caller) and `easy_pos.api.customer.get_customer_with_loyalty`,
	which folds this straight into the customer fetch so the POS Terminal's Cart
	only needs one round trip when a cashier picks a customer instead of two."""
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


@frappe.whitelist()
def get_customer_loyalty_summary(customer: str, company: str | None = None) -> dict:
	"""Standalone endpoint kept for callers that only need the loyalty summary
	on its own (e.g. InvoicePay's redeem UI, which already has the customer
	loaded via Cart). The POS Terminal's own customer-select flow no longer
	calls this directly — see easy_pos.api.customer.get_customer_with_loyalty."""
	return _get_customer_loyalty_summary(customer, company)
