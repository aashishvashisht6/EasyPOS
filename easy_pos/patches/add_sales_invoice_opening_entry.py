import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def execute():
	create_custom_fields(
		{
			"Sales Invoice": [
				{
					"fieldname": "custom_ep_opening_entry",
					"label": "EP Opening Entry",
					"fieldtype": "Link",
					"options": "EP Opening Entry",
					"insert_after": "pos_profile",
					"read_only": 1,
					"hidden": 0,
					"no_copy": 1,
					"description": (
						"The POS shift (Opening Entry) this invoice was created under. Used "
						"to scope POS Closing's expected-amount calculation to the current "
						"shift instead of every invoice ever raised against the POS Profile."
					),
				}
			]
		}
	)
