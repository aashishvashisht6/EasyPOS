"""Creates a small set of demo Items (normal, serialized, batch-tracked, and a
Product Bundle "combo") plus Standard Selling Item Prices for each, so the POS
Terminal has something realistic to search/scan/checkout against.

Run with:

	bench --site <site> execute easy_pos.setup.create_demo_data.execute --args "['<company>']"

or, without a company (falls back to the site's default Company, throwing if
none is set):

	bench --site <site> execute easy_pos.setup.create_demo_data.execute

Also reachable from the Desk UI via EASYPOS Settings' "Create Demo Data"
button (easypos_settings.js / easypos_settings.py), which prompts for the
company and calls this same `execute()`.

Idempotent — safe to re-run; existing items/prices/bundle are left as-is
(only newly-missing records are created), so re-running after adding new
demo rows here won't duplicate anything already created. Re-running with a
different company just adds that company's row to each item's Item Defaults
child table (default warehouse) alongside any already there.

Also posts a single Material Receipt Stock Entry giving every stock item
(everything except the combo's own bundle-parent item, which ERPNext never
stocks directly — see the Product Bundle gotcha below) DEMO_STOCK_QTY units
of opening stock, so the POS Terminal has something to actually sell. For the
serialized/batch items this is done via `use_serial_batch_fields=1` with no
explicit serial/batch numbers, which lets ERPNext auto-generate them off the
item's own serial_no_series/batch_number_series on submit (mirrors
erpnext.stock.doctype.stock_entry.test_stock_entry's
test_serial_batch_bundle_type_of_transaction) — no manual Serial No/Batch
creation needed here. Re-running only tops up each item to DEMO_STOCK_QTY
(via each item's current Bin.actual_qty), so it won't keep piling up stock on
repeat runs.

Per the Product Bundle gotcha in CLAUDE.md, a bundle's component items must
NOT have has_serial_no/has_batch_no set or checkout throws — the two combo
components below are plain stock items for that reason.
"""

import frappe
from frappe import _
from frappe.utils import flt, nowdate

ITEM_GROUP = "Demo Items"
UOM = "Nos"
DEMO_STOCK_QTY = 50

# (item_code, item_name, has_serial_no, has_batch_no, is_stock_item, standard_rate)
NORMAL_ITEMS = [
	("EP-DEMO-COLA", "Demo Cola 500ml", 0, 0, 1, 40),
	("EP-DEMO-CHIPS", "Demo Chips Pack", 0, 0, 1, 60),
]

SERIALIZED_ITEMS = [
	("EP-DEMO-LAPTOP", "Demo Laptop", "SR-DEMO-LAPTOP-.#####", 55000),
]

BATCH_ITEMS = [
	("EP-DEMO-MILK", "Demo Milk 1L", "BN-DEMO-MILK-.#####", 55),
]

# Product Bundle components must be plain stock items (no serial/batch) —
# see module docstring.
COMBO_COMPONENTS = [
	("EP-DEMO-BURGER", "Demo Burger", 1, 220),
	("EP-DEMO-FRIES", "Demo Fries", 1, 90),
]

# (bundle_item_code, bundle_item_name, standard_rate, [(component_item_code, qty), ...])
COMBOS = [
	(
		"EP-DEMO-COMBO",
		"Demo Meal Combo",
		280,
		[("EP-DEMO-BURGER", 1), ("EP-DEMO-FRIES", 1)],
	),
]


def execute(company=None):
	company = company or frappe.defaults.get_global_default("company")
	if not company:
		frappe.throw(_("Cannot create demo data: no company was given and no default Company is set."))

	warehouse = _ensure_warehouse(company)
	price_list = _get_default_selling_price_list()
	_ensure_item_group()

	rates = {}
	# (item_code, needs_serial_or_batch) for every item that should get
	# opening stock — excludes the bundle parent, which is never a stock item.
	stock_targets = []

	for item_code, item_name, has_serial_no, has_batch_no, is_stock_item, rate in NORMAL_ITEMS:
		_ensure_item(
			item_code,
			item_name,
			has_serial_no=has_serial_no,
			has_batch_no=has_batch_no,
			is_stock_item=is_stock_item,
		)
		rates[item_code] = rate
		if is_stock_item:
			stock_targets.append((item_code, False))

	for item_code, item_name, serial_no_series, rate in SERIALIZED_ITEMS:
		_ensure_item(
			item_code,
			item_name,
			has_serial_no=1,
			serial_no_series=serial_no_series,
		)
		rates[item_code] = rate
		stock_targets.append((item_code, True))

	for item_code, item_name, batch_number_series, rate in BATCH_ITEMS:
		_ensure_item(
			item_code,
			item_name,
			has_batch_no=1,
			create_new_batch=1,
			batch_number_series=batch_number_series,
		)
		rates[item_code] = rate
		stock_targets.append((item_code, True))

	for item_code, item_name, is_stock_item, rate in COMBO_COMPONENTS:
		_ensure_item(item_code, item_name, is_stock_item=is_stock_item)
		rates[item_code] = rate
		if is_stock_item:
			stock_targets.append((item_code, False))

	for bundle_item_code, bundle_item_name, rate, components in COMBOS:
		# Bundle parent's own stock isn't tracked — ERPNext explodes the
		# Sales Invoice line into the components' stock via the packing
		# list instead (see CLAUDE.md's Product Bundle gotcha). Not added
		# to stock_targets.
		_ensure_item(bundle_item_code, bundle_item_name, is_stock_item=0)
		rates[bundle_item_code] = rate
		_ensure_product_bundle(bundle_item_code, components)

	for item_code, rate in rates.items():
		_ensure_item_price(item_code, price_list, rate)
		_ensure_item_default(item_code, company, warehouse)

	stock_entry_name = _ensure_opening_stock(stock_targets, rates, company, warehouse)

	# This is a one-off setup script invoked via `bench execute` outside the normal
	# request/response cycle, so there's no request-teardown commit to rely on.
	frappe.db.commit()  # nosemgrep: frappe-manual-commit

	summary = {
		"items": len(rates),
		"price_list": price_list,
		"company": company,
		"warehouse": warehouse,
		"stock_entry": stock_entry_name,
		"stock_qty_target": DEMO_STOCK_QTY,
	}
	print(
		f"Demo data ready — {summary['items']} items priced against '{price_list}' "
		f"for '{company}' (warehouse: '{warehouse}'). "
		+ (
			f"Opening stock posted via {stock_entry_name}."
			if stock_entry_name
			else "Stock already topped up."
		)
	)
	return summary


def _get_default_selling_price_list():
	return frappe.db.get_single_value("Selling Settings", "selling_price_list") or "Standard Selling"


def _ensure_warehouse(company):
	"""A stable leaf Warehouse under `company` to use as every demo item's
	default — prefers one literally named "Stores" (ERPNext's own default
	warehouse on a new Company), else the alphabetically-first leaf
	warehouse, so repeat calls always resolve to the same warehouse instead
	of whatever unordered row the DB happens to return first. Creates a
	"Demo Store" warehouse if the company has no leaf warehouse at all yet
	(a brand-new/empty Company only has its auto-created group warehouses)."""
	stores = frappe.get_all(
		"Warehouse",
		filters={"company": company, "is_group": 0, "warehouse_name": "Stores"},
		limit=1,
		pluck="name",
	)
	if stores:
		return stores[0]

	existing = frappe.get_all(
		"Warehouse",
		filters={"company": company, "is_group": 0},
		order_by="name asc",
		limit=1,
		pluck="name",
	)
	if existing:
		return existing[0]

	abbr = frappe.get_cached_value("Company", company, "abbr")
	warehouse_name = "Demo Store"
	full_name = f"{warehouse_name} - {abbr}"
	if frappe.db.exists("Warehouse", full_name):
		return full_name

	doc = frappe.get_doc({"doctype": "Warehouse", "warehouse_name": warehouse_name, "company": company})
	doc.insert(ignore_permissions=True)
	return doc.name


def _ensure_opening_stock(stock_targets, rates, company, warehouse):
	"""Tops every (item_code, needs_serial_or_batch) in `stock_targets` up to
	DEMO_STOCK_QTY in `warehouse` via one Material Receipt Stock Entry,
	skipping items already at/above that qty. Returns the Stock Entry name,
	or None if nothing needed topping up."""
	rows = []
	for item_code, needs_serial_or_batch in stock_targets:
		current_qty = flt(
			frappe.db.get_value("Bin", {"item_code": item_code, "warehouse": warehouse}, "actual_qty")
		)
		shortfall = DEMO_STOCK_QTY - current_qty
		if shortfall <= 0:
			continue

		row = {
			"item_code": item_code,
			"qty": shortfall,
			"t_warehouse": warehouse,
			"basic_rate": rates[item_code],
		}
		if needs_serial_or_batch:
			# Leave serial_no/batch_no blank — Stock Entry auto-generates
			# them from the item's own serial_no_series/batch_number_series
			# on submit when use_serial_batch_fields=1 and none are given.
			row["use_serial_batch_fields"] = 1
		rows.append(row)

	if not rows:
		return None

	stock_entry = frappe.get_doc(
		{
			"doctype": "Stock Entry",
			"stock_entry_type": "Material Receipt",
			"company": company,
			"posting_date": nowdate(),
			"items": rows,
		}
	)
	stock_entry.insert(ignore_permissions=True)
	stock_entry.submit()
	return stock_entry.name


def _ensure_item_default(item_code, company, warehouse):
	doc = frappe.get_doc("Item", item_code)
	if any(row.company == company for row in doc.item_defaults):
		return
	doc.append("item_defaults", {"company": company, "default_warehouse": warehouse})
	doc.save(ignore_permissions=True)


def _ensure_item_group():
	if frappe.db.exists("Item Group", ITEM_GROUP):
		return
	root = frappe.db.get_value("Item Group", {"is_group": 1, "parent_item_group": ["is", "not set"]}, "name")
	frappe.get_doc(
		{
			"doctype": "Item Group",
			"item_group_name": ITEM_GROUP,
			"parent_item_group": root,
			"is_group": 0,
		}
	).insert(ignore_permissions=True)


def _ensure_item(item_code, item_name, **kwargs):
	if frappe.db.exists("Item", item_code):
		return frappe.get_doc("Item", item_code)

	doc = frappe.get_doc(
		{
			"doctype": "Item",
			"item_code": item_code,
			"item_name": item_name,
			"item_group": ITEM_GROUP,
			"stock_uom": UOM,
			"is_stock_item": 1,
			"include_item_in_manufacturing": 0,
			"has_serial_no": 0,
			"has_batch_no": 0,
			**kwargs,
		}
	)
	doc.insert(ignore_permissions=True)
	return doc


def _ensure_product_bundle(bundle_item_code, components):
	if frappe.db.exists("Product Bundle", bundle_item_code):
		return

	frappe.get_doc(
		{
			"doctype": "Product Bundle",
			"new_item_code": bundle_item_code,
			"items": [{"item_code": item_code, "qty": qty, "uom": UOM} for item_code, qty in components],
		}
	).insert(ignore_permissions=True)


def _ensure_item_price(item_code, price_list, rate):
	existing = frappe.db.get_value("Item Price", {"item_code": item_code, "price_list": price_list}, "name")
	if existing:
		frappe.db.set_value("Item Price", existing, "price_list_rate", rate)
		return

	frappe.get_doc(
		{
			"doctype": "Item Price",
			"item_code": item_code,
			"price_list": price_list,
			"selling": 1,
			"currency": frappe.db.get_value("Price List", price_list, "currency")
			or frappe.defaults.get_global_default("currency"),
			"price_list_rate": rate,
			"valid_from": nowdate(),
		}
	).insert(ignore_permissions=True)
