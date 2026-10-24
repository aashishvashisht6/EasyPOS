import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def execute():
	create_custom_fields(
		{
			"Sales Invoice": [
				{
					"fieldname": "ep_split_group",
					"label": "EP Split Group",
					"fieldtype": "Data",
					"insert_after": "custom_ep_opening_entry",
					"read_only": 1,
					"no_copy": 1,
					"search_index": 1,
					"description": (
						"Client-generated ID shared by every Sales Invoice created from one "
						"POS Terminal cart split by item (Split Bill). Unset for normal sales "
						"and for even/custom-amount splits, which stay a single invoice."
					),
				},
				{
					"fieldname": "ep_split_index",
					"label": "EP Split Bill",
					"fieldtype": "Data",
					"insert_after": "ep_split_group",
					"read_only": 1,
					"no_copy": 1,
					"description": 'This invoice\'s position within its split, e.g. "2/3".',
				},
			]
		}
	)
