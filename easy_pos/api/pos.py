import frappe
import json
from frappe.utils import now, today, flt, cint, get_number_format_info


def get_currency_precision() -> int:
	"""Same resolution ERPNext itself uses (erpnext.accounts.utils.get_currency_precision):
	System Settings' explicit Currency Precision, else derived from the Number Format."""
	precision = cint(frappe.db.get_default("currency_precision"))
	if not precision:
		number_format = frappe.db.get_default("number_format") or "#,###.##"
		precision = get_number_format_info(number_format)[2]
	return precision


def get_float_precision() -> int:
	return cint(frappe.db.get_default("float_precision")) or 3


@frappe.whitelist()
def get_precision_settings() -> dict:
	return {
		"currency_precision": get_currency_precision(),
		"float_precision": get_float_precision(),
	}


@frappe.whitelist()
def check_opening_entry(user: str) -> dict:
	open_vouchers = frappe.get_all(
		"EP Opening Entry",
		filters={"user": user, "ep_closing_entry": ["in", ["", None]], "docstatus": 1},
		fields=["name"],
		order_by="period_start_date desc",
		limit=1
	)

	return frappe.get_doc("EP Opening Entry", open_vouchers[0].get('name')).as_dict() if open_vouchers else {}

@frappe.whitelist()
def get_closing_entry(opening_details: dict) -> dict:
	open_voucher = frappe.get_doc("EP Opening Entry", opening_details.get("name"))
	pos_profile = frappe.get_doc("POS Profile", opening_details.get("pos_profile"))

	SalesInvoice = frappe.qb.DocType("Sales Invoice")
	SalesInvoicePayment = frappe.qb.DocType("Sales Invoice Payment")

	query = (
			frappe.qb.from_(SalesInvoice)
			.join(SalesInvoicePayment).on(SalesInvoicePayment.parent == SalesInvoice.name)
			.select(SalesInvoicePayment.mode_of_payment, SalesInvoicePayment.amount).where(
			(SalesInvoice.custom_ep_opening_entry == opening_details.get("name"))
			& (SalesInvoice.docstatus == 1)
			).groupby(SalesInvoicePayment.mode_of_payment)
			)
	payments = query.run(as_dict=True)

	closing_amount_dict = { payment.get("mode_of_payment"): payment.get("amount") for payment in payments }
	opening_amount_dict = {
		balance.get("mode_of_payment"): balance.get("opening_amount")
		for balance in open_voucher.get("balance_details")
	}

	closing_balance = []

	# Derived from the POS Profile's currently configured payment modes (not the
	# Opening Entry's snapshot) so newly added modes show up for an already-open shift.
	for payment_row in pos_profile.get("payments"):
		mode_of_payment = payment_row.get("mode_of_payment")
		opening_amount = opening_amount_dict.get(mode_of_payment, 0)
		closing_amount = closing_amount_dict.get(mode_of_payment, 0)
		closing_balance.append({
			"mode_of_payment": mode_of_payment,
			"opening_amount": opening_amount,
			"closing_amount": closing_amount,
			"automatically_calculated": cint(payment_row.get("ep_automatically_calculated", 1)),
		})

	return {"details": closing_balance}

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

	if closing_details.get("pos_opening_entry"):
		frappe.db.set_value(
			"EP Opening Entry",
			closing_details.get("pos_opening_entry"),
			"ep_closing_entry",
			closing_entry.name,
		)

	return closing_entry.as_dict()


@frappe.whitelist()
def create_invoice(invoice: dict, opening_details: dict, submit: bool) -> dict:
	# Same warehouse + price list the terminal fetched stock/rate from (see
	# easy_pos.api.item.get_items) so the invoice deducts stock from where it
	# was actually shown as available, completing the POS Profile-driven flow.
	pos_profile = frappe.get_cached_doc("POS Profile", opening_details.get("pos_profile"))

	currency_precision = get_currency_precision()

	# Order-level ("additional") discount from the cart, mapped onto the Sales
	# Invoice's own discount fields so it flows through the standard
	# calculate_taxes_and_totals recalculation instead of being lost. Rounded
	# to the same precision the frontend used, so the stored value matches what
	# the cashier saw rather than drifting when Frappe re-rounds on save.
	additional_discount_percentage = flt(invoice.get("additional_discount_percentage"), precision=get_float_precision())
	discount_fields = {
		"additional_discount_percentage": additional_discount_percentage,
		"apply_discount_on": invoice.get("apply_discount_on") or "Grand Total",
	} if additional_discount_percentage else {
		"additional_discount_percentage": 0,
		"discount_amount": 0,
	}

	items = invoice.get("items") or []
	for item in items:
		item["rate"] = flt(item.get("rate"), precision=currency_precision)
		item["amount"] = flt(item.get("amount"), precision=currency_precision)
		item["discount_amount"] = flt(item.get("discount_amount"), precision=currency_precision)

	payments = invoice.get("payments") or []
	for payment in payments:
		payment["amount"] = flt(payment.get("amount"), precision=currency_precision)

	if invoice.get("sales_invoice"):
		sales_invoice = frappe.get_doc("Sales Invoice", invoice.get("sales_invoice"))
		sales_invoice.update({
			"items": invoice.get("items"),
			"payments": invoice.get("payments"),
			"update_stock": 1,
			"set_warehouse": pos_profile.warehouse,
			"selling_price_list": pos_profile.selling_price_list,
			**discount_fields,
		})
		sales_invoice.save()
	else:
		sales_invoice = frappe.get_doc({"doctype": "Sales Invoice", "customer": invoice.get("customer"),
								 "items": invoice.get("items"), "pos_profile": opening_details.get("pos_profile"),
								 "custom_ep_opening_entry": opening_details.get("name"), "is_pos": 1,
								 "payments": invoice.get("payments"),
								 "update_stock": 1,
								 "set_warehouse": pos_profile.warehouse,
								 "selling_price_list": pos_profile.selling_price_list,
								 **discount_fields,
								 })
		sales_invoice.insert()

	if submit:
		sales_invoice.submit()

	return sales_invoice.as_dict()
	