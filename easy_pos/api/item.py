import frappe
from frappe.utils import flt
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
    for item in items:
        if warehouse and item.get("is_stock_item"):
            item.stock = stock_map.get(item.item_code, 0)
        else:
            item.stock = None
        item.rate = (
            flt(rate_map.get(item.item_code, 0), precision=currency_precision) if price_list else None
        )
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
    # for group in item_groups:
    #     if not group.image:
    #         group['image'] = "https://dreamspos.dreamstechnologies.com/html/template/assets/img/products/pos-product-01.png"
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
    # for item in items:
    #     if not item.image:
    #         item.image = "https://dreamspos.dreamstechnologies.com/html/template/assets/img/products/pos-product-01.png"
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
