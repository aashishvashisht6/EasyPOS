import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def execute():
	create_custom_fields(
		{
			"Sales Invoice": [
				{
					"fieldname": "ep_offline_id",
					"label": "EP Offline ID",
					"fieldtype": "Data",
					"unique": 1,
					"insert_after": "due_date",
					"read_only": 1,
					"hidden": 0,
					"no_copy": 1,
					"description": (
						"Client-generated UUID stamped on a Sales Invoice created via the POS "
						"Terminal's offline write queue. Used to make pushing a queued invoice "
						"idempotent — a retried push looks up the invoice by this ID before "
						"inserting a new one. Unset for invoices created while online."
					),
				}
			]
		}
	)
