import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def execute():
	create_custom_fields(
		{
			"POS Profile": [
				{
					"fieldname": "ep_email_notification",
					"label": "Email Notification",
					"fieldtype": "Link",
					"options": "Notification",
					"insert_after": "print_format",
					"description": (
						"Notification (channel: Email) sent to the customer's email on the "
						"Sales Invoice once a POS order completes."
					),
				},
				{
					"fieldname": "ep_sms_notification",
					"label": "SMS Notification",
					"fieldtype": "Link",
					"options": "Notification",
					"insert_after": "ep_email_notification",
					"description": (
						"Notification (channel: SMS) sent to the customer's mobile number on the "
						"Sales Invoice once a POS order completes."
					),
				},
			]
		}
	)
