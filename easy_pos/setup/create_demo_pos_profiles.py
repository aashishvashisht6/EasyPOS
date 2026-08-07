"""Creates 5 demo POS Profiles, each showcasing a different feature built
into easy_pos so far, plus the two demo Notification docs the "Receipt
Notifications" profile links to. Depends on easy_pos.setup.create_demo_data
having already run for the same company (uses its warehouse/price list
resolution and the EP-DEMO-* items for nothing directly, but assumes a
"Demo Items" catalogue exists so the profiles have something to sell).

Run with:

	bench --site <site> execute easy_pos.setup.create_demo_pos_profiles.execute --kwargs "{'company': '<company>'}"

Also reachable from the Desk UI via EASYPOS Settings' "Create Demo Data"
button, which runs this right after easy_pos.setup.create_demo_data.

Idempotent — safe to re-run; a profile/notification already present (by
name) is left untouched.
"""

import frappe

from easy_pos.setup.create_demo_data import _ensure_warehouse, _get_default_selling_price_list

CASH = "Cash"
CREDIT_CARD = "Credit Card"

EMAIL_NOTIFICATION = "EP Demo - Email Receipt"
SMS_NOTIFICATION = "EP Demo - SMS Receipt"

# Cash is always manually counted at closing (not auto-calculated) across
# every demo profile below — cashiers physically count the cash drawer, so
# this mirrors real-world usage regardless of what other modes on the same
# profile do.
CASH_ROW = {"mode_of_payment": CASH, "default": 1, "automatically_calculated": 0}

# (profile_name, payments, extra_fields)
# payments: list of {mode_of_payment, default, automatically_calculated, gateway}
PROFILES = [
	(
		"EP Demo - Standard Counter",
		[CASH_ROW],
		{},
	),
	(
		"EP Demo - Manual Closing Counter",
		[
			CASH_ROW,
			# Contrasts with Cash's always-manual row above — Credit Card
			# here is auto-calculated, showing the per-payment-mode split.
			{"mode_of_payment": CREDIT_CARD, "automatically_calculated": 1},
		],
		{},
	),
	(
		"EP Demo - Gateway Counter",
		[
			CASH_ROW,
			{"mode_of_payment": CREDIT_CARD, "automatically_calculated": 1, "gateway": "Razorpay"},
		],
		{},
	),
	(
		"EP Demo - Customer Display Counter",
		[CASH_ROW],
		{"ep_customer_display_enabled": 1},
	),
	(
		"EP Demo - Receipt Notifications Counter",
		[CASH_ROW],
		{"ep_email_notification": EMAIL_NOTIFICATION, "ep_sms_notification": SMS_NOTIFICATION},
	),
]


def execute(company=None):
	company = company or frappe.defaults.get_global_default("company")
	if not company:
		frappe.throw("Cannot create demo POS Profiles: no company was given and no default Company is set.")

	warehouse = _ensure_warehouse(company)
	price_list = _get_default_selling_price_list()
	company_defaults = frappe.db.get_value(
		"Company", company, ["default_currency", "write_off_account", "cost_center"], as_dict=True
	)
	if not company_defaults.write_off_account or not company_defaults.cost_center:
		frappe.throw(
			f"Company '{company}' is missing a default Write Off Account / Cost Center — "
			"set those on the Company before creating demo POS Profiles."
		)

	_ensure_demo_notifications()

	modes_used = {row["mode_of_payment"] for _, payments, _ in PROFILES for row in payments}
	for mode in modes_used:
		_ensure_mode_of_payment_account(mode, company)

	created = []
	for profile_name, payments, extra_fields in PROFILES:
		if _ensure_pos_profile(
			profile_name, company, warehouse, price_list, company_defaults, payments, extra_fields
		):
			created.append(profile_name)

	frappe.db.commit()

	summary = {
		"company": company,
		"profiles": [name for name, _, _ in PROFILES],
		"profiles_created": created,
	}
	print(
		f"Demo POS Profiles ready for '{company}': {', '.join(summary['profiles'])} "
		f"({len(created)} newly created)."
	)
	return summary


def _ensure_demo_notifications():
	"""Lightweight Email + SMS Notification docs on Sales Invoice for the
	"Receipt Notifications" profile to link — real, linkable configuration
	objects (per easy_pos's Notification-based receipt delivery feature),
	though actual delivery still depends on the site having working
	Email/SMS Settings, same as any other Notification."""
	if not frappe.db.exists("Notification", EMAIL_NOTIFICATION):
		frappe.get_doc(
			{
				"doctype": "Notification",
				"subject": EMAIL_NOTIFICATION,
				"document_type": "Sales Invoice",
				"event": "Submit",
				"channel": "Email",
				"attach_print": 1,
				"recipients": [{"receiver_by_document_field": "contact_email"}],
				"message": (
					"<p>Hi,</p><p>Thanks for your purchase — invoice {{ doc.name }} "
					"for {{ doc.grand_total }} is attached.</p>"
				),
			}
		).insert(ignore_permissions=True)

	if not frappe.db.exists("Notification", SMS_NOTIFICATION):
		frappe.get_doc(
			{
				"doctype": "Notification",
				"subject": SMS_NOTIFICATION,
				"document_type": "Sales Invoice",
				"event": "Submit",
				"channel": "SMS",
				"recipients": [{"receiver_by_document_field": "contact_mobile"}],
				"message": "Thanks for your purchase! Invoice {{ doc.name }}, total {{ doc.grand_total }}.",
			}
		).insert(ignore_permissions=True)


def _ensure_mode_of_payment_account(mode_of_payment, company):
	"""POS Profile.validate_payment_methods requires every payment mode it
	uses to have a company-scoped Mode of Payment Account with a
	default_account set, or insert throws "Please set default Cash or Bank
	account in Mode of Payment ...". A fresh/demo Company only has this
	wired up for "Cash" (from Company's own default_cash_account) — any
	other mode (e.g. Credit Card) needs one created here."""
	existing = frappe.db.get_value(
		"Mode of Payment Account", {"parent": mode_of_payment, "company": company}, "default_account"
	)
	if existing:
		return existing

	account = _ensure_demo_bank_account(company)
	mop = frappe.get_doc("Mode of Payment", mode_of_payment)
	mop.append("accounts", {"company": company, "default_account": account})
	mop.save(ignore_permissions=True)
	return account


def _ensure_demo_bank_account(company):
	abbr = frappe.get_cached_value("Company", company, "abbr")
	full_name = f"EP Demo Bank - {abbr}"
	if frappe.db.exists("Account", full_name):
		return full_name

	parent = frappe.db.get_value(
		"Account", {"company": company, "account_type": "Bank", "is_group": 1}, "name"
	)
	doc = frappe.get_doc(
		{
			"doctype": "Account",
			"account_name": "EP Demo Bank",
			"company": company,
			"parent_account": parent,
			"account_type": "Bank",
			"is_group": 0,
		}
	)
	doc.insert(ignore_permissions=True)
	return doc.name


def _ensure_pos_profile(name, company, warehouse, price_list, company_defaults, payments, extra_fields):
	if frappe.db.exists("POS Profile", name):
		return False

	payment_rows = []
	for row in payments:
		payment_rows.append(
			{
				"mode_of_payment": row["mode_of_payment"],
				"default": row.get("default", 0),
				"ep_automatically_calculated": row.get("automatically_calculated", 1),
				"ep_payment_gateway": row.get("gateway", ""),
			}
		)

	frappe.get_doc(
		{
			"doctype": "POS Profile",
			"name": name,
			"company": company,
			"warehouse": warehouse,
			"currency": company_defaults.default_currency,
			"selling_price_list": price_list,
			"write_off_account": company_defaults.write_off_account,
			"write_off_cost_center": company_defaults.cost_center,
			"write_off_limit": 1,
			"payments": payment_rows,
			**extra_fields,
		}
	).insert(ignore_permissions=True)
	return True
