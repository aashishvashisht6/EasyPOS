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
def get_closing_entry(opening_details: dict) -> dict:
	open_voucher = frappe.get_doc("EP Opening Entry", opening_details.get("name"))

	SalesInvoice = frappe.qb.DocType("Sales Invoice")
	SalesInvoicePayment = frappe.qb.DocType("Sales Invoice Payment")

	query = (
			frappe.qb.from_(SalesInvoice)
			.join(SalesInvoicePayment).on(SalesInvoicePayment.parent == SalesInvoice.name)
			.select(SalesInvoicePayment.mode_of_payment, SalesInvoicePayment.amount).where(
			(SalesInvoice.pos_profile == opening_details.get("pos_profile"))
			& (SalesInvoice.docstatus == 1)
			).groupby(SalesInvoicePayment.mode_of_payment)
			)
	payments = query.run(as_dict=True)

	closing_amount_dict = { payment.get("mode_of_payment"): payment.get("amount") for payment in payments }

	closing_balance = []

	for balance in open_voucher.get("balance_details"):
		mode_of_payment = balance.get("mode_of_payment")
		opening_amount = balance.get("opening_amount")
		closing_amount = closing_amount_dict.get(mode_of_payment, 0)
		closing_balance.append({
			"mode_of_payment": mode_of_payment,
			"opening_amount": opening_amount,
			"closing_amount": closing_amount
		})

	return closing_balance

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
def create_closing_entry(closing_details: dict) -> dict:
	closing_entry = frappe.get_doc({
                    "doctype": "EP Closing Entry",
                    "company": closing_details.get('company'),
                    "pos_profile": closing_details.get("pos_profile"),
                    "payment_reconciliation": closing_details.get('closing_details'),
                    "period_start_date": closing_details.get("period_start_date"),
                    "posting_date": today(),
					"posting_time": now(),
					"pos_opening_entry": closing_details.get("pos_opening_entry"),
                    "user": frappe.session.user
                }).insert().submit()
	
	return closing_entry.as_dict()			

@frappe.whitelist()
def create_invoice(invoice: dict, opening_details: dict, submit: bool) -> dict:
	if invoice.get("sales_invoice"):
		sales_invoice = frappe.get_doc("Sales Invoice", invoice.get("sales_invoice"))
		sales_invoice.update({
			"items": invoice.get("items"),
			"payments": invoice.get("payments"),
			"update_stock": 1
		})
		sales_invoice.save()
	else:
		sales_invoice = frappe.get_doc({"doctype": "Sales Invoice", "customer": invoice.get("customer"),
								 "items": invoice.get("items"), "pos_profile": opening_details.get("pos_profile"),
								 "custom_ep_opening_entry": opening_details.get("name"), "is_pos": 1,
								 "payments": invoice.get("payments"),
								 "update_stock": 1,
								 })
		sales_invoice.insert()

	if submit:
		sales_invoice.submit()
	
	return sales_invoice.as_dict()
	