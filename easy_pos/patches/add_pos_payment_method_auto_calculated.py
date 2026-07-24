import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def execute():
	create_custom_fields(
		{
			"POS Payment Method": [
				{
					"fieldname": "ep_automatically_calculated",
					"label": "Automatically Calculated",
					"fieldtype": "Check",
					"default": "1",
					"insert_after": "allow_in_returns",
					"description": (
						"When checked, the closing amount for this payment method is "
						"calculated automatically from sales. Uncheck to have the cashier "
						"manually count and enter the amount at POS closing."
					),
				}
			]
		}
	)

	# Carry forward the old POS Profile-level setting onto each payment row so
	# existing profiles keep behaving the same way after the field moves to
	# child-table level.
	manually_entered_profiles = frappe.get_all(
		"POS Profile",
		filters={"ep_closing_entry_type": "Manually Entered"},
		pluck="name",
	)
	if manually_entered_profiles:
		frappe.db.set_value(
			"POS Payment Method",
			{"parenttype": "POS Profile", "parent": ["in", manually_entered_profiles]},
			"ep_automatically_calculated",
			0,
		)

	frappe.delete_doc(
		"Custom Field",
		frappe.db.get_value("Custom Field", {"dt": "POS Profile", "fieldname": "ep_closing_entry_type"}),
		ignore_missing=True,
		force=True,
	)
