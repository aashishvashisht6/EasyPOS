import frappe
from frappe.utils import flt, getdate, nowdate
from easy_pos.api.pos import get_currency_precision

ITEM_FIELDS = [
	"name as item_code",
	"item_name",
	"description",
	"item_group",
	"image",
	"has_serial_no",
	"has_batch_no",
	"is_stock_item",
]


def _get_stock_map(item_codes, warehouse):
    """actual_qty per item_code for the given warehouse; empty until a warehouse is known."""
    if not warehouse or not item_codes:
        return {}
    rows = frappe.get_all(
        "Bin",
        filters={"item_code": ["in", item_codes], "warehouse": warehouse},
        fields=["item_code", "actual_qty"],
    )
    return {row.item_code: row.actual_qty for row in rows}


def _company_from_warehouse(warehouse):
    """Item Tax Template resolution is company-scoped in ERPNext (a template
    only applies if its own `company` matches the transaction's company —
    erpnext.stock.get_item_details._get_item_tax_template). The POS terminal
    doesn't collect a company directly, but a warehouse always belongs to
    exactly one, so it's derived from there; stays None until a warehouse is
    known, in which case no company filtering happens (matches every item's
    template, same as before this template resolution existed).
    """
    if not warehouse:
        return None
    return frappe.get_cached_value("Warehouse", warehouse, "company")


def _first_valid_item_tax_template(parent_names, company):
    """{parent: item_tax_template} — first Item Tax row per parent (an Item or
    an Item Group; both use the same child doctype) whose template is
    enabled, matches `company` (when known), and isn't date-scoped to a
    `valid_from` in the future. Mirrors
    erpnext.stock.get_item_details._get_item_tax_template's own disabled/
    company/validity checks; tax_category matching is left out since the POS
    terminal doesn't collect a customer Tax Category, so only the default
    (blank tax_category) row applies — same simplification as before.
    Minimum/maximum net rate validity (also supported by ERPNext for the same
    row) isn't checked here — a rarer setup this terminal doesn't yet cover.
    """
    if not parent_names:
        return {}
    ItemTax = frappe.qb.DocType("Item Tax")
    rows = (
        frappe.qb.from_(ItemTax)
        .select(ItemTax.parent, ItemTax.item_tax_template, ItemTax.tax_category, ItemTax.valid_from)
        .where(ItemTax.parent.isin(parent_names))
    ).run(as_dict=True)

    today = getdate(nowdate())
    result = {}
    for row in rows:
        if row.parent in result or row.tax_category:
            continue
        if row.valid_from and getdate(row.valid_from) > today:
            continue
        template_disabled, template_company = frappe.get_cached_value(
            "Item Tax Template", row.item_tax_template, ["disabled", "company"]
        )
        if template_disabled:
            continue
        if company and template_company != company:
            continue
        result[row.parent] = row.item_tax_template
    return result


def _item_group_chain(item_group, parent_of):
    """[item_group, its parent, its grandparent, ...] — walks parent_item_group
    the same way erpnext.stock.get_item_details._get_item_tax_template_from_item_group
    walks get_ancestors_of("Item Group", ...), so a group tax can be inherited
    from any ancestor, not just the item's immediate group."""
    chain = []
    seen = set()
    while item_group and item_group not in seen:
        chain.append(item_group)
        seen.add(item_group)
        item_group = parent_of.get(item_group)
    return chain


def _resolve_item_tax_templates(items, company):
    """{item_code: item_tax_template}, honoring ERPNext's own priority order
    (erpnext.stock.get_item_details.get_item_tax_template): the item's own
    Item Tax Template wins first; only if the item has none does its Item
    Group's template apply, checked at the item's own group and then each
    ancestor group in turn; an item matching neither falls back to the plain
    order-level tax rate, same as ERPNext.
    """
    item_codes = [item.item_code for item in items]
    item_level = _first_valid_item_tax_template(item_codes, company)

    needed_codes = [code for code in item_codes if code not in item_level]
    if not needed_codes:
        return item_level

    item_groups_by_code = {item.item_code: item.item_group for item in items}
    parent_of = {
        g.name: g.parent_item_group
        for g in frappe.get_all("Item Group", fields=["name", "parent_item_group"])
    }
    group_chains = {code: _item_group_chain(item_groups_by_code.get(code), parent_of) for code in needed_codes}
    all_groups_needed = {group for chain in group_chains.values() for group in chain}
    group_level = _first_valid_item_tax_template(list(all_groups_needed), company)

    resolved = dict(item_level)
    for code in needed_codes:
        for group in group_chains[code]:
            if group in group_level:
                resolved[code] = group_level[group]
                break
    return resolved


def _get_item_tax_map(items, warehouse):
    """{item_code: (item_tax_template, {account_head: rate})} — see
    _resolve_item_tax_templates for the item-then-item-group priority. The
    template name must round-trip back to create_invoice as each Sales
    Invoice Item's `item_tax_template` — ERPNext's own update_item_tax_map
    (erpnext.controllers.taxes_and_totals) only rebuilds item_tax_rate from
    whatever item_tax_template is already on the row, it does not look it up
    from the Item itself. The rate map is only for the terminal's pre-save
    preview; an item resolving to no template falls back to the order-level
    tax rate, same as ERPNext.
    """
    if not items:
        return {}
    company = _company_from_warehouse(warehouse)
    item_templates = _resolve_item_tax_templates(items, company)

    template_names = list({t for t in item_templates.values() if t})
    template_rates = {}
    for template_name in template_names:
        rate_map = {}
        for row in frappe.get_cached_doc("Item Tax Template", template_name).taxes:
            # erpnext.stock.get_item_details.get_item_tax_map only includes a
            # row whose Account belongs to the same company — a shared
            # template listing accounts across companies shouldn't leak a
            # foreign company's rate into this one's tax preview.
            if company and frappe.get_cached_value("Account", row.tax_type, "company") != company:
                continue
            rate_map[row.tax_type] = flt(row.tax_rate)
        template_rates[template_name] = rate_map

    return {
        item_code: (template_name, template_rates.get(template_name, {}))
        for item_code, template_name in item_templates.items()
        if template_name
    }


def _get_rate_map(item_codes, price_list):
    """price_list_rate per item_code for the given selling price list; empty until a price list is known."""
    if not price_list or not item_codes:
        return {}
    rows = frappe.get_all(
        "Item Price",
        filters={"item_code": ["in", item_codes], "price_list": price_list, "selling": 1},
        fields=["item_code", "price_list_rate"],
    )
    rate_map = {}
    for row in rows:
        # First match wins — a second Item Price row for the same item (eg. a
        # customer-specific rate) shouldn't override the general price list rate.
        rate_map.setdefault(row.item_code, row.price_list_rate)
    return rate_map


def _attach_stock_and_rate(items, warehouse, price_list):
    """
    Stamps stock/rate onto each item dict in place. Both stay None until a
    warehouse/price list is known — ie. before an Opening Entry exists — so the
    terminal can show "no stock/rate yet" instead of a misleading placeholder.
    Once known, a missing Bin/Item Price row genuinely means the value is 0.

    Non-stock items (services) never carry a Bin row, so stock always stays
    None for them regardless of warehouse — the terminal treats None as "not
    stock-tracked" and never blocks adding them to the cart.
    """
    currency_precision = get_currency_precision()
    item_codes = [item.item_code for item in items]
    stock_map = _get_stock_map(item_codes, warehouse)
    rate_map = _get_rate_map(item_codes, price_list)
    tax_map = _get_item_tax_map(items, warehouse)
    for item in items:
        if warehouse and item.get("is_stock_item"):
            item.stock = stock_map.get(item.item_code, 0)
        else:
            item.stock = None
        item.rate = (
            flt(rate_map.get(item.item_code, 0), precision=currency_precision) if price_list else None
        )
        item.item_tax_template, item.item_tax_rate = tax_map.get(item.item_code, ("", {}))
    return items


def _get_item(item_code, warehouse=None, price_list=None, **extra):
    item = frappe.db.get_value("Item", item_code, ITEM_FIELDS, as_dict=True)
    if not item:
        return None
    _attach_stock_and_rate([item], warehouse, price_list)
    item.update(extra)
    return item


@frappe.whitelist()
def get_item_groups():
    """Getting All Item groups as needs for offline functionality"""
    item_groups = frappe.get_all("Item Group", filters={}, fields=["name as item_group", "image"], order_by="lft asc")
    return item_groups

@frappe.whitelist()
def get_items(item_group=None, warehouse=None, price_list=None):
    """
    Getting All Items as needs for offline functionality.
    stock/rate are resolved from `warehouse`/`price_list` — the POS Profile
    behind the cashier's Opening Entry — and stay None until those are known.
    """
    filters = {"disabled":0, "has_variants":0}
    if item_group:

        # Checking if parent group then fetching all child groups otherwise we check only selected group
        if frappe.get_cached_value("Item Group", item_group, "is_group"):
            child_groups = frappe.get_all("Item Group", filters={"parent_item_group": item_group}, fields=["name"], order_by="lft asc")
            groups = [group.name for group in child_groups]
            groups.extend(item_group)
            filters.update({"item_group": ["in", groups]})
        else:
            filters.update({"item_group": item_group})

    items = frappe.get_all(
        "Item",
        filters=filters,
        fields=ITEM_FIELDS,
        order_by="name asc",
    )
    _attach_stock_and_rate(items, warehouse, price_list)
    return items


@frappe.whitelist()
def search_item(search_text, warehouse=None, price_list=None):
    """
    Resolve a scanned/typed value against everything a cashier might key into the
    POS search box: an item barcode, a serial no, a batch no, an exact item code,
    or a fuzzy item code/name/barcode search. stock/rate are resolved the same
    way as get_items — from the warehouse/price list behind the Opening Entry.

    Returns {"match_type": "barcode"|"serial_no"|"batch_no"|"item_code"|"search", "items": [...]}
    "items" has exactly one entry for the first four (exact) match types, so the
    caller can auto-add to cart without extra clicks; "search" may return many.
    """
    search_text = (search_text or "").strip()
    if not search_text:
        return {"match_type": "search", "items": []}

    # 1. Barcode — exact match on the Item's barcodes child table
    item_code = frappe.db.get_value("Item Barcode", {"barcode": search_text}, "parent")
    if item_code:
        item = _get_item(item_code, warehouse, price_list)
        if item:
            return {"match_type": "barcode", "items": [item]}

    # 2. Serial No — exact match, carries its item + batch along
    if frappe.db.exists("Serial No", search_text):
        serial = frappe.db.get_value("Serial No", search_text, ["item_code", "batch_no"], as_dict=True)
        item = _get_item(serial.item_code, warehouse, price_list, serial_no=search_text, batch_no=serial.batch_no or "")
        if item:
            return {"match_type": "serial_no", "items": [item]}

    # 3. Batch No — exact match
    if frappe.db.exists("Batch", search_text):
        batch_item = frappe.db.get_value("Batch", search_text, "item")
        item = _get_item(batch_item, warehouse, price_list, batch_no=search_text)
        if item:
            return {"match_type": "batch_no", "items": [item]}

    # 4. Item code — exact match
    if frappe.db.exists("Item", search_text):
        item = _get_item(search_text, warehouse, price_list)
        if item:
            return {"match_type": "item_code", "items": [item]}

    # 5. Fallback — fuzzy search across item code, item name, and barcode
    like = f"%{search_text}%"
    Item = frappe.qb.DocType("Item")
    ItemBarcode = frappe.qb.DocType("Item Barcode")
    query = (
        frappe.qb.from_(Item)
        .left_join(ItemBarcode)
        .on(ItemBarcode.parent == Item.name)
        .select(
            Item.name.as_("item_code"),
            Item.item_name,
            Item.description,
            Item.item_group,
            Item.image,
            Item.has_serial_no,
            Item.has_batch_no,
            Item.is_stock_item,
        )
        .distinct()
        .where(
            (Item.disabled == 0)
            & (Item.has_variants == 0)
            & (
                Item.name.like(like)
                | Item.item_name.like(like)
                | ItemBarcode.barcode.like(like)
            )
        )
        .orderby(Item.name)
        .limit(50)
    )
    items = query.run(as_dict=True)
    _attach_stock_and_rate(items, warehouse, price_list)
    return {"match_type": "search", "items": items}
