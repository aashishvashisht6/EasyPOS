# Copyright (c) 2026, Aashish and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class EPCashMovement(Document):
	def validate(self):
		if flt(self.amount) <= 0:
			frappe.throw(_("Amount must be greater than zero"))
		self._validate_shift_open()

		allowed_modes = frappe.get_all(
			"POS Payment Method", filters={"parent": self.pos_profile, "parenttype": "POS Profile"}, pluck="mode_of_payment"
		)
		if self.mode_of_payment not in allowed_modes:
			frappe.throw(
				_("{0} is not a payment mode of POS Profile {1}").format(self.mode_of_payment, self.pos_profile)
			)

	def before_cancel(self):
		# The shift's closing counts already included this movement — undoing it
		# afterwards would leave that closed shift's reconciliation wrong.
		self._validate_shift_open()

	def _validate_shift_open(self):
		docstatus, closing_entry = frappe.db.get_value(
			"EP Opening Entry", self.opening_entry, ["docstatus", "ep_closing_entry"]
		)
		if docstatus != 1 or closing_entry:
			frappe.throw(_("Shift {0} is not open").format(self.opening_entry))
