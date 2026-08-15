import frappe
from frappe import _
from frappe.utils import flt

from easy_pos.api.payment_gateways import get_gateway
from easy_pos.api.pos import _finalize_invoice, _save_sales_invoice, get_currency_precision


@frappe.whitelist()
def get_payment_gateway_config(gateway: str) -> dict:
	"""Whether `gateway` is actually configured (credentials set) — a POS Payment
	Method row can be flagged for a gateway before that gateway's settings are
	filled in, so InvoicePay checks this separately from the flag itself."""
	return get_gateway(gateway).get_config()


@frappe.whitelist()
def create_payment_gateway_order(gateway: str, invoice: dict, opening_details: dict, amount: float) -> dict:
	"""Saves/updates the cart as a Draft Sales Invoice (same shape create_invoice
	would produce) and opens a gateway order for `amount` — the balance the
	cashier is routing through the gateway-flagged payment mode. The invoice is
	only submitted once verify_payment_gateway_order confirms the charge succeeded."""
	module = get_gateway(gateway)

	sales_invoice, _pos_profile = _save_sales_invoice(invoice, opening_details)

	amount = flt(amount, precision=get_currency_precision())
	if amount <= 0:
		frappe.throw(f"{gateway} amount must be greater than zero")

	order = module.create_order(sales_invoice, amount)
	order["sales_invoice"] = sales_invoice.name
	return order


@frappe.whitelist()
def verify_payment_gateway_order(
	gateway: str, sales_invoice: str, payload: dict, coupon_code: str | None = None
) -> dict:
	module = get_gateway(gateway)

	sales_invoice = frappe.get_doc("Sales Invoice", sales_invoice)
	if sales_invoice.docstatus != 0:
		frappe.throw(_("This invoice has already been finalized"))

	reference = module.verify(sales_invoice, payload)
	sales_invoice.ep_payment_gateway_reference = reference

	pos_profile = frappe.get_cached_doc("POS Profile", sales_invoice.pos_profile)
	_finalize_invoice(sales_invoice, pos_profile, coupon_code)

	return sales_invoice.as_dict()
