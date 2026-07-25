import frappe


@frappe.whitelist()
def get_easypos_settings() -> dict:
	return frappe.get_single("EASYPOS Settings").as_dict()
