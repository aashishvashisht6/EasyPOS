import frappe
import json
from frappe.utils import now, today

@frappe.whitelist()
def check_opening_entry(user: str) -> dict:
	open_vouchers = frappe.get_all(
		"EP Opening Entry",
		filters={"user": user, "pos_closing_entry": ["in", ["", None]], "docstatus": 1},
		fields=["name"],
		order_by="period_start_date desc",
		limit=1
	)

	return frappe.get_doc("EP Opening Entry", open_vouchers[0].get('name')).as_dict() if open_vouchers else {}

@frappe.whitelist()
def create_opening_entry(opening_details: dict) -> dict:
	opening_entry = frappe.get_doc({
                    "doctype": "EP Opening Entry",
                    "company": opening_details.get('company'),
                    "pos_profile": opening_details.get("pos_profile"),
                    "balance_details": opening_details.get('balance_details'),
                    "period_start_date": now(),
                    "posting_date": today(),
                    "user": frappe.session.user
                }).insert().submit()
	
	return opening_entry.as_dict()

@frappe.whitelist()
def create_invoice(invoice: dict, opening_details: dict, submit: bool) -> dict:
	sales_invoice = frappe.get_doc({"doctype": "Sales Invoice", "customer": invoice.get("customer"),
								 "items": invoice.get("items"), "pos_profile": opening_details.get("pos_profile"),
								 "custom_ep_opening_entry": opening_details.get("name"), "is_pos": 1,
								 "payments": invoice.get("payments"),
								#  "update_stock": 1,
								 })
	sales_invoice.insert()

	# if submit:
	# 	sales_invoice.submit()
	
	return sales_invoice.as_dict()
	