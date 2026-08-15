import frappe


@frappe.whitelist()
def get_list(
	doctype: str,
	fields: list | None = None,
	filters: dict | list | None = None,
	or_filters: dict | list | None = None,
	order_by: str | None = None,
	limit_start: int = 0,
	limit_page_length: int = 20,
) -> dict:
	"""Generic paginated list fetch shared by POS list-view pages (Invoices, Customers, ...).

	filters/or_filters accept anything frappe.get_list understands (dict or list of
	[fieldname, operator, value] conditions). Uses frappe.get_list (not get_all) so
	doctype/field-level read permissions are enforced for the requesting user.
	"""
	fields = fields or ["name"]
	filters = filters or {}
	or_filters = or_filters or {}

	data = frappe.get_list(
		doctype,
		fields=fields,
		filters=filters,
		or_filters=or_filters,
		order_by=order_by or "modified desc",
		limit_start=frappe.utils.cint(limit_start),
		limit_page_length=frappe.utils.cint(limit_page_length),
	)

	total_count = len(
		frappe.get_list(doctype, fields=["name"], filters=filters, or_filters=or_filters, limit_page_length=0)
	)

	return {"data": data, "total_count": total_count}
