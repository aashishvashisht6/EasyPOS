import frappe


def execute():
	# Gates EP Cash Movement (mid-shift Cash In / Cash Out): a cashier holding
	# this role records movements directly; one without it needs a holder's
	# approval (username + password) in the POS Terminal's Cash In/Out modal —
	# see easy_pos.api.cash_movement.create_cash_movement.
	if frappe.db.exists("Role", "POS Cash Manager"):
		return
	frappe.get_doc({"doctype": "Role", "role_name": "POS Cash Manager", "desk_access": 1}).insert(
		ignore_permissions=True
	)
