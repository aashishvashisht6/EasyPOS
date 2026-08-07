"""Creates 5 demo Customers spanning different customer types/groups, so the
POS Terminal / Customers list has realistic data to search against, and the
"Receipt Notifications" demo POS Profile has a customer with real contact
info to actually test against (Sales Invoice's contact_email/contact_mobile
are populated from a Customer's auto-created primary Contact — see
erpnext.selling.doctype.customer.customer.Customer.create_primary_contact).

Run with:

	bench --site <site> execute easy_pos.setup.create_demo_customers.execute

Also reachable from the Desk UI via EASYPOS Settings' "Create Demo Data"
button, which runs this alongside easy_pos.setup.create_demo_data and
easy_pos.setup.create_demo_pos_profiles.

Idempotent — safe to re-run; a customer already present (by name) is left
untouched. Assumes the site's Selling Settings' cust_master_name is
"Customer Name" (the default), same assumption the frontend's
NewCustomerModal/createCustomer already make — if a site instead names
Customers off a Naming Series, the exists-by-name check below won't catch a
customer that was renamed after creation, and could create a duplicate.
"""

import frappe

# (customer_name, customer_type, customer_group, mobile_no, email_id)
CUSTOMERS = [
	("EP Demo Walk-in Customer", "Individual", "Individual", "", ""),
	("EP Demo Retail Customer", "Individual", "Individual", "9998887771", "retail.demo@example.com"),
	("EP Demo Business Customer", "Company", "Commercial", "9998887772", "business.demo@example.com"),
	("EP Demo VIP Customer", "Individual", "Individual", "9998887773", "vip.demo@example.com"),
	(
		"EP Demo Notification Test Customer",
		"Individual",
		"Individual",
		"9998887774",
		"notify.demo@example.com",
	),
]


def execute():
	territory = _resolve_territory()

	created = []
	for customer_name, customer_type, customer_group, mobile_no, email_id in CUSTOMERS:
		group = _resolve_customer_group(customer_group)
		if _ensure_customer(customer_name, customer_type, group, territory, mobile_no, email_id):
			created.append(customer_name)

	frappe.db.commit()

	summary = {"customers": [c[0] for c in CUSTOMERS], "customers_created": created}
	print(f"Demo customers ready: {', '.join(summary['customers'])} ({len(created)} newly created).")
	return summary


def _resolve_customer_group(preferred):
	"""`preferred` (e.g. "Individual"/"Commercial") if the site has it,
	else the root Customer Group — keeps this working on a bare-bones site
	that only has the default "All Customer Groups" root."""
	if frappe.db.exists("Customer Group", preferred):
		return preferred
	return frappe.db.get_value(
		"Customer Group", {"is_group": 1, "parent_customer_group": ["is", "not set"]}, "name"
	)


def _resolve_territory():
	if frappe.db.exists("Territory", "All Territories"):
		return "All Territories"
	return frappe.db.get_value("Territory", {"is_group": 1, "parent_territory": ["is", "not set"]}, "name")


def _ensure_customer(customer_name, customer_type, customer_group, territory, mobile_no, email_id):
	if frappe.db.exists("Customer", customer_name):
		return False

	frappe.get_doc(
		{
			"doctype": "Customer",
			"customer_name": customer_name,
			"customer_type": customer_type,
			"customer_group": customer_group,
			"territory": territory,
			"mobile_no": mobile_no,
			"email_id": email_id,
		}
	).insert(ignore_permissions=True)
	return True
