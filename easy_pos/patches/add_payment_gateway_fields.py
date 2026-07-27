import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def execute():
	create_custom_fields(
		{
			"POS Payment Method": [
				{
					"fieldname": "ep_payment_gateway",
					"label": "Payment Gateway",
					"fieldtype": "Select",
					# New gateways are added here and to easy_pos.api.payment_gateways'
					# registry — no InvoicePay/frontend change needed beyond that.
					"options": "\nRazorpay",
					"insert_after": "ep_automatically_calculated",
					"description": (
						"When set, the cashier enters an amount to charge and Complete "
						"Payment opens this gateway's checkout (UPI QR / card) instead of "
						"treating it as manually received. Set at most one payment mode "
						"per POS Profile this way."
					),
				}
			],
			"Sales Invoice": [
				{
					"fieldname": "ep_payment_gateway_reference",
					"label": "Payment Gateway Reference",
					"fieldtype": "Data",
					"read_only": 1,
					"insert_after": "is_pos",
					"description": "Payment gateway's transaction/payment id that settled this invoice, for support/audit lookup.",
				}
			],
		}
	)
