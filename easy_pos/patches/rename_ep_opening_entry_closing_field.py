import frappe
from frappe.query_builder.functions import IfNull


def execute():
	if frappe.db.has_column("EP Opening Entry", "pos_closing_entry"):
		EPOpeningEntry = frappe.qb.DocType("EP Opening Entry")
		(
			frappe.qb.update(EPOpeningEntry)
			.set(EPOpeningEntry.ep_closing_entry, EPOpeningEntry.pos_closing_entry)
			.where(IfNull(EPOpeningEntry.pos_closing_entry, "") != "")
		).run()
