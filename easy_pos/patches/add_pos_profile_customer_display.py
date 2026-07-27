import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def execute():
	create_custom_fields(
		{
			"POS Profile": [
				{
					"fieldname": "ep_customer_display_enabled",
					"label": "Enable Customer Display",
					"fieldtype": "Check",
					"insert_after": "print_receipt_on_order_complete",
					"default": "0",
					"description": (
						"Shows an 'Open Customer Display' button on the Terminal that opens a "
						"second window (for a second monitor) mirroring the cart and totals live "
						"for the customer to see."
					),
				}
			],
		}
	)
