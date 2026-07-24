import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def execute():
	create_custom_fields(
		{
			"POS Profile": [
				{
					"fieldname": "ep_closing_entry_type",
					"label": "Closing Entry Type",
					"fieldtype": "Select",
					"options": "Automatically Calculated\nManually Entered",
					"default": "Automatically Calculated",
					"insert_after": "country",
					"description": (
						"Controls how the Cash amount is filled in POS Closing: automatically "
						"calculated from sales, or manually counted and entered by the cashier."
					),
				}
			]
		}
	)
