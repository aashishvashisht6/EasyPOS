import frappe
import json
from frappe.query_builder.functions import Sum
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
			.select(SalesInvoicePayment.mode_of_payment, Sum(SalesInvoicePayment.amount).as_("amount")).where(
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
def get_taxes_and_charges_template(taxes_and_charges: str = None) -> list:
	"""Resolved order-level tax rows for a Sales Taxes and Charges Template —
	the same shape the terminal needs to preview taxes before the invoice is
	saved. POS invoices (is_pos=1) skip ERPNext's own auto-population of the
	`taxes` table from this template (see accounts_controller.set_taxes_and_charges,
	which early-returns when is_pos is set), so the terminal must build and pass
	the `taxes` rows itself on create_invoice, same as create_credit_note already
	does by copying the original invoice's taxes."""
	if not taxes_and_charges:
		return []
	doc = frappe.get_cached_doc("Sales Taxes and Charges Template", taxes_and_charges)
	return [
		{
			"charge_type": row.charge_type,
			"row_id": row.row_id,
			"account_head": row.account_head,
			"description": row.description,
			"cost_center": row.cost_center,
			"rate": row.rate,
			"tax_amount": row.tax_amount,
			"included_in_print_rate": row.included_in_print_rate,
		}
		for row in doc.taxes
	]


def _save_sales_invoice(invoice: dict, opening_details: dict):
	"""Builds/updates the Sales Invoice doc from cart payload + opening details and
	inserts/saves it (Draft, since callers decide separately whether to submit).
	Shared by create_invoice and the Razorpay order flow so a gateway-backed
	checkout constructs the exact same Draft a manual-cash checkout would."""
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
		# Pricing Rule outcome from easy_pos.api.pricing.get_cart_pricing, carried
		# through so the saved Sales Invoice Item records what actually discounted
		# it (desk's own POS/Sales Invoice persists the same fields).
		if item.get("price_list_rate") is not None:
			item["price_list_rate"] = flt(item.get("price_list_rate"), precision=currency_precision)
		if item.get("discount_percentage") is not None:
			item["discount_percentage"] = flt(item.get("discount_percentage"))

	payments = invoice.get("payments") or []
	for payment in payments:
		payment["amount"] = flt(payment.get("amount"), precision=currency_precision)

	# Order-level tax rows the terminal computed from the POS Profile's
	# taxes_and_charges template (see get_taxes_and_charges_template) — POS
	# invoices don't get these auto-populated server-side (is_pos short-circuits
	# accounts_controller.set_taxes_and_charges), so they must be passed in
	# explicitly, same as create_credit_note does for returns. tax_amount is
	# only a display hint from the frontend preview; calculate_taxes_and_totals
	# recomputes it for real from rate + item_tax_rate on save.
	taxes = []
	for tax in invoice.get("taxes") or []:
		taxes.append({
			"charge_type": tax.get("charge_type"),
			"row_id": tax.get("row_id"),
			"account_head": tax.get("account_head"),
			"description": tax.get("description"),
			"cost_center": tax.get("cost_center"),
			"rate": flt(tax.get("rate")),
			"tax_amount": flt(tax.get("tax_amount"), precision=currency_precision),
			"included_in_print_rate": tax.get("included_in_print_rate"),
		})
	tax_fields = {"taxes": taxes, "taxes_and_charges": pos_profile.taxes_and_charges}

	# Loyalty Program earn/redeem — ERPNext's own Sales Invoice.on_submit /
	# calculate_taxes_and_totals do the actual work (create the earned
	# Loyalty Point Entry, fold loyalty_amount into paid_amount) as long as
	# these fields are set going in; see erpnext.accounts.doctype.sales_invoice.
	# loyalty_program is set whenever the customer is enrolled (so points are
	# earned even when the cashier isn't redeeming this time); redemption only
	# applies when the cashier explicitly ticked it with a positive points value.
	redeeming = bool(invoice.get("redeem_loyalty_points")) and cint(invoice.get("loyalty_points")) > 0
	loyalty_fields = {
		"loyalty_program": invoice.get("loyalty_program") or "",
		"redeem_loyalty_points": 1 if redeeming else 0,
		"loyalty_points": cint(invoice.get("loyalty_points")) if redeeming else 0,
	}

	if invoice.get("sales_invoice"):
		sales_invoice = frappe.get_doc("Sales Invoice", invoice.get("sales_invoice"))
		sales_invoice.update({
			"items": invoice.get("items"),
			"payments": invoice.get("payments"),
			"update_stock": 1,
			"set_warehouse": pos_profile.warehouse,
			"selling_price_list": pos_profile.selling_price_list,
			**discount_fields,
			**tax_fields,
			**loyalty_fields,
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
								 **tax_fields,
								 **loyalty_fields,
								 })
		sales_invoice.insert()

	return sales_invoice, pos_profile


def _finalize_invoice(sales_invoice, pos_profile, coupon_code: str = None) -> None:
	"""Submit + coupon redemption + receipt notifications — the tail end shared by
	a normal create_invoice(submit=True) and a payment gateway order being confirmed
	(see easy_pos.api.payment.verify_payment_gateway_order)."""
	sales_invoice.submit()
	if coupon_code:
		from easy_pos.api.pricing import _coupon_code_name
		from erpnext.accounts.doctype.pricing_rule.utils import update_coupon_code_count

		coupon_name = _coupon_code_name(coupon_code)
		if coupon_name:
			update_coupon_code_count(coupon_name, "used")

	send_receipt_notifications(sales_invoice, pos_profile)


@frappe.whitelist()
def create_invoice(invoice: dict, opening_details: dict, submit: bool, coupon_code: str = None) -> dict:
	sales_invoice, pos_profile = _save_sales_invoice(invoice, opening_details)

	if submit:
		_finalize_invoice(sales_invoice, pos_profile, coupon_code)

	return sales_invoice.as_dict()


def send_receipt_notifications(sales_invoice, pos_profile) -> None:
	# Notification.send() resolves recipients from its own `recipients` child
	# table and already logs/swallows per-channel failures internally.
	for fieldname in ("ep_email_notification", "ep_sms_notification"):
		notification_name = pos_profile.get(fieldname)
		if not notification_name:
			continue
		try:
			notification = frappe.get_cached_doc("Notification", notification_name)
			if notification.enabled:
				notification.send(sales_invoice)
		except Exception:
			frappe.log_error(
				title="POS receipt notification failed",
				message=frappe.get_traceback(),
			)


@frappe.whitelist()
def cancel_sales_invoice(name: str) -> dict:
	sales_invoice = frappe.get_doc("Sales Invoice", name)
	sales_invoice.cancel()
	return sales_invoice.as_dict()


@frappe.whitelist()
def create_credit_note(name: str, items: list, taxes: list = None) -> dict:
	original = frappe.get_doc("Sales Invoice", name)

	if original.docstatus != 1:
		frappe.throw("Only a submitted invoice can be returned")
	if original.is_return:
		frappe.throw("Cannot create a credit note against a credit note")

	currency_precision = get_currency_precision()

	return_items = []
	for item in items or []:
		qty = flt(item.get("qty"))
		if not qty:
			continue
		return_items.append({
			"item_code": item.get("item_code"),
			"item_name": item.get("item_name"),
			"uom": item.get("uom"),
			"rate": flt(item.get("rate"), precision=currency_precision),
			"qty": -abs(qty),
			"warehouse": item.get("warehouse") or original.set_warehouse,
			"income_account": item.get("income_account"),
			"cost_center": item.get("cost_center"),
		})

	if not return_items:
		frappe.throw("Select at least one item to return")

	# charge_type "Actual" uses tax_amount directly; percentage-based charge
	# types (On Net Total, On Previous Row Amount, ...) recompute tax_amount
	# from rate against the return's own (negative) net total — both fields
	# are passed through so either editable column takes effect correctly.
	return_taxes = []
	for tax in taxes or []:
		return_taxes.append({
			"charge_type": tax.get("charge_type"),
			"account_head": tax.get("account_head"),
			"description": tax.get("description"),
			"cost_center": tax.get("cost_center"),
			"rate": flt(tax.get("rate")),
			"tax_amount": flt(tax.get("tax_amount"), precision=currency_precision),
		})

	credit_note = frappe.get_doc({
		"doctype": "Sales Invoice",
		"customer": original.customer,
		"company": original.company,
		"is_return": 1,
		"return_against": name,
		"selling_price_list": original.selling_price_list,
		"currency": original.currency,
		"set_warehouse": original.set_warehouse,
		"update_stock": 1,
		"items": return_items,
		"taxes": return_taxes,
		"taxes_and_charges": original.taxes_and_charges,
		# Mirrors the original invoice's POS context so the credit note shows
		# up in the Invoices list view (fetchInvoices filters on is_pos=1) and
		# stays scoped to the same shift for closing calculations — a return
		# with is_pos unset silently disappeared from the list page.
		"is_pos": original.is_pos,
		"pos_profile": original.pos_profile,
		"custom_ep_opening_entry": original.custom_ep_opening_entry,
	})
	credit_note.insert()
	credit_note.submit()

	return credit_note.as_dict()


def _hour_of(posting_time) -> int:
	"""Sales Invoice.posting_time comes back as a timedelta via frappe.qb, or a
	'HH:MM:SS' string via frappe.get_all — normalize both to an hour bucket."""
	if isinstance(posting_time, str):
		return int(posting_time.split(":")[0]) if posting_time else 0
	if hasattr(posting_time, "seconds"):
		return int(posting_time.seconds // 3600)
	return 0


@frappe.whitelist()
def get_past_shifts(limit: int = 30) -> list:
	"""Closed EP Opening Entry records for the logged-in cashier, most recent first —
	powers the Reports page's shift picker so a cashier can review a past shift's
	summary (get_sales_report's 'shift' scope already accepts any opening_entry,
	not just the currently open one)."""
	return frappe.get_all(
		"EP Opening Entry",
		filters={
			"user": frappe.session.user,
			"docstatus": 1,
			"ep_closing_entry": ["not in", ["", None]],
		},
		fields=["name", "pos_profile", "period_start_date"],
		order_by="period_start_date desc",
		limit_page_length=cint(limit),
	)


@frappe.whitelist()
def get_sales_report(scope: str, opening_entry: str = None, pos_profile: str = None, from_date: str = None, to_date: str = None) -> dict:
	"""Cashier-scoped reports/dashboard data. `scope` is 'shift' (all invoices under
	the given opening entry), or 'today'/'range' (the logged-in cashier's own invoices,
	optionally narrowed to a POS Profile, over from_date..to_date)."""
	SalesInvoice = frappe.qb.DocType("Sales Invoice")
	SalesInvoiceItem = frappe.qb.DocType("Sales Invoice Item")
	SalesInvoicePayment = frappe.qb.DocType("Sales Invoice Payment")

	condition = (SalesInvoice.docstatus == 1) & (SalesInvoice.is_pos == 1)

	if scope == "shift":
		if not opening_entry:
			frappe.throw("opening_entry is required for shift scope")
		condition &= SalesInvoice.custom_ep_opening_entry == opening_entry
	else:
		condition &= SalesInvoice.owner == frappe.session.user
		if pos_profile:
			condition &= SalesInvoice.pos_profile == pos_profile
		if from_date and to_date:
			condition &= (SalesInvoice.posting_date >= from_date) & (SalesInvoice.posting_date <= to_date)

	invoices = (
		frappe.qb.from_(SalesInvoice)
		.select(
			SalesInvoice.name,
			SalesInvoice.grand_total,
			SalesInvoice.is_return,
			SalesInvoice.discount_amount,
			SalesInvoice.posting_date,
			SalesInvoice.posting_time,
			SalesInvoice.customer_name,
		)
		.where(condition)
	).run(as_dict=True)

	sales = [inv for inv in invoices if not cint(inv.is_return)]
	returns = [inv for inv in invoices if cint(inv.is_return)]

	gross_sales = sum(flt(inv.grand_total) for inv in sales)
	returns_amount = sum(abs(flt(inv.grand_total)) for inv in returns)
	discount_amount = sum(flt(inv.discount_amount) for inv in sales)
	transaction_count = len(sales)

	trend_bucket = {}
	group_by_hour = scope in ("shift", "today")
	for inv in sales:
		key = _hour_of(inv.posting_time) if group_by_hour else str(inv.posting_date)
		trend_bucket[key] = trend_bucket.get(key, 0) + flt(inv.grand_total)

	if group_by_hour:
		sales_trend = [
			{"label": f"{hour:02d}:00", "amount": trend_bucket.get(hour, 0)}
			for hour in sorted(trend_bucket.keys())
		]
	else:
		sales_trend = [{"label": key, "amount": amount} for key, amount in sorted(trend_bucket.items())]

	payments = (
		frappe.qb.from_(SalesInvoice)
		.join(SalesInvoicePayment)
		.on(SalesInvoicePayment.parent == SalesInvoice.name)
		.select(SalesInvoicePayment.mode_of_payment, Sum(SalesInvoicePayment.amount).as_("amount"))
		.where(condition)
		.groupby(SalesInvoicePayment.mode_of_payment)
	).run(as_dict=True)

	top_items = (
		frappe.qb.from_(SalesInvoice)
		.join(SalesInvoiceItem)
		.on(SalesInvoiceItem.parent == SalesInvoice.name)
		.select(
			SalesInvoiceItem.item_code,
			SalesInvoiceItem.item_name,
			Sum(SalesInvoiceItem.qty).as_("qty"),
			Sum(SalesInvoiceItem.amount).as_("amount"),
		)
		.where(condition)
		.groupby(SalesInvoiceItem.item_code, SalesInvoiceItem.item_name)
		.orderby(Sum(SalesInvoiceItem.amount), order=frappe.qb.desc)
		.limit(8)
	).run(as_dict=True)

	shift_summary = None
	if scope == "shift":
		open_voucher = frappe.get_doc("EP Opening Entry", opening_entry)
		shift_summary = get_closing_entry({"name": opening_entry, "pos_profile": open_voucher.pos_profile})

	recent_invoices = sorted(
		invoices, key=lambda inv: (str(inv.posting_date), str(inv.posting_time)), reverse=True
	)[:8]

	return {
		"kpis": {
			"gross_sales": gross_sales,
			"net_sales": gross_sales - returns_amount - discount_amount,
			"transaction_count": transaction_count,
			"avg_ticket": (gross_sales / transaction_count) if transaction_count else 0,
		},
		"payment_breakdown": payments,
		"sales_trend": sales_trend,
		"top_items": top_items,
		"discounts": {
			"discount_amount": discount_amount,
			"discount_count": len([inv for inv in sales if flt(inv.discount_amount) > 0]),
			"return_amount": returns_amount,
			"return_count": len(returns),
		},
		"shift_summary": shift_summary,
		"recent_invoices": recent_invoices,
	}
