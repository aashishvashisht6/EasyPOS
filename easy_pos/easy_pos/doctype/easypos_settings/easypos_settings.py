# Copyright (c) 2026, Aashish and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class EASYPOSSettings(Document):
	pass


@frappe.whitelist()
def create_demo_data(company: str) -> dict:
	"""Called from the "Create Demo Data" button on this Single doctype's
	Desk form. Thin wrapper around easy_pos.setup.create_demo_data.execute
	(items, prices, opening stock), easy_pos.setup.create_demo_pos_profiles
	.execute (5 POS Profiles showing off different features), and
	easy_pos.setup.create_demo_customers.execute (5 demo Customers) — see
	those modules for what actually gets created."""
	frappe.only_for("System Manager")

	from easy_pos.setup.create_demo_customers import execute as create_customers
	from easy_pos.setup.create_demo_data import execute as create_items
	from easy_pos.setup.create_demo_pos_profiles import execute as create_pos_profiles

	items_summary = create_items(company=company)
	profiles_summary = create_pos_profiles(company=company)
	customers_summary = create_customers()

	return {**items_summary, **profiles_summary, **customers_summary}
