import frappe
from frappe.query_builder.functions import IfNull
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
	"has_variants",
]


def _get_bundle_item_codes(item_codes):
    """Subset of `item_codes` that are a Product Bundle's parent item (`new_item_code`)
    — mirrors erpnext.stock.doctype.packed_item.packed_item.is_product_bundle, batched
    for the whole grid/search result instead of one exists() check per item."""
    if not item_codes:
        return set()
    rows = frappe.get_all(
        "Product Bundle",
        filters={"new_item_code": ["in", item_codes], "disabled": 0},
        pluck="new_item_code",
    )
    return set(rows)


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


def _get_rate_map(item_codes, price_list, customer=None):
    """price_list_rate per item_code for the given selling price list; empty until a price list is known.

    Resolution order per item (mirrors erpnext.stock.get_item_details.get_price_list_rate's
    intent, simplified for the grid/search preview — the full engine, incl.
    Pricing Rule application, runs at cart time via easy_pos.api.pricing.get_cart_pricing):
    1. A customer-specific Item Price row (customer set, matching `customer`) for this price list.
    2. A generic Item Price row (no customer) for this price list.
    Both are further filtered to rows whose valid_from/valid_upto window includes
    today; if neither yields a match, the Item's own `standard_rate` is used.
    """
    if not price_list or not item_codes:
        return {}
    today = getdate(nowdate())
    filters = {"item_code": ["in", item_codes], "price_list": price_list, "selling": 1}
    rows = frappe.get_all(
        "Item Price",
        filters=filters,
        fields=["item_code", "price_list_rate", "customer", "valid_from", "valid_upto"],
    )

    def _is_valid(row):
        if row.valid_from and getdate(row.valid_from) > today:
            return False
        if row.valid_upto and getdate(row.valid_upto) < today:
            return False
        return True

    customer_rate, generic_rate = {}, {}
    for row in rows:
        if not _is_valid(row):
            continue
        if customer and row.customer == customer:
            customer_rate.setdefault(row.item_code, row.price_list_rate)
        elif not row.customer:
            generic_rate.setdefault(row.item_code, row.price_list_rate)

    rate_map = {}
    for item_code in item_codes:
        if item_code in customer_rate:
            rate_map[item_code] = customer_rate[item_code]
        elif item_code in generic_rate:
            rate_map[item_code] = generic_rate[item_code]

    missing = [code for code in item_codes if code not in rate_map]
    if missing:
        standard_rates = frappe.get_all(
            "Item", filters={"name": ["in", missing]}, fields=["name", "standard_rate"]
        )
        for row in standard_rates:
            if row.standard_rate:
                rate_map[row.name] = row.standard_rate

    return rate_map


def _allowed_item_groups(pos_profile):
    """Set of Item Group names the given POS Profile restricts the terminal to
    (expanded to include descendants of each configured group), or None when
    the profile's `item_groups` child table is empty — ERPNext's own convention
    for "no restriction, every group allowed"."""
    if not pos_profile:
        return None
    rows = frappe.get_all(
        "POS Item Group",
        filters={"parent": pos_profile, "parenttype": "POS Profile"},
        fields=["item_group"],
    )
    if not rows:
        return None

    groups = frappe.get_all("Item Group", fields=["name", "parent_item_group"])
    children_of = {}
    for g in groups:
        children_of.setdefault(g.parent_item_group, []).append(g.name)

    expanded = set()
    stack = [row.item_group for row in rows]
    while stack:
        group = stack.pop()
        if group in expanded:
            continue
        expanded.add(group)
        stack.extend(children_of.get(group, []))
    return expanded


def _attach_stock_and_rate(items, warehouse, price_list, customer=None):
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
    rate_map = _get_rate_map(item_codes, price_list, customer)
    tax_map = _get_item_tax_map(items, warehouse)
    bundle_codes = _get_bundle_item_codes(item_codes)
    for item in items:
        # A variant template (has_variants=1) isn't sellable itself — its own
        # stock/rate are meaningless until a specific variant is picked via
        # get_item_variants, so both stay None the way they do before a
        # warehouse/price list is known.
        if item.get("has_variants"):
            item.stock = None
            item.rate = None
            item.item_tax_template, item.item_tax_rate = "", {}
            item.is_product_bundle = False
            continue
        if warehouse and item.get("is_stock_item"):
            item.stock = stock_map.get(item.item_code, 0)
        else:
            item.stock = None
        item.rate = (
            flt(rate_map.get(item.item_code, 0), precision=currency_precision) if price_list else None
        )
        item.item_tax_template, item.item_tax_rate = tax_map.get(item.item_code, ("", {}))
        item.is_product_bundle = item.item_code in bundle_codes
    return items


def _get_item(item_code, warehouse=None, price_list=None, customer=None, **extra):
    item = frappe.db.get_value("Item", item_code, ITEM_FIELDS, as_dict=True)
    if not item:
        return None
    _attach_stock_and_rate([item], warehouse, price_list, customer)
    item.update(extra)
    return item


@frappe.whitelist()
def get_product_bundle_contents(item_code):
    """Component rows of the Product Bundle whose `new_item_code` is `item_code`
    — display-only for the cart line's detail panel (see is_product_bundle
    above). ERPNext explodes the actual bundle into Sales Invoice `packed_items`
    itself (make_packing_list, fired from Sales Invoice.validate whenever
    update_stock=1, which create_invoice always sets) — this is purely a
    preview so the cashier can see what's inside before checking out.
    """
    ProductBundle = frappe.qb.DocType("Product Bundle")
    ProductBundleItem = frappe.qb.DocType("Product Bundle Item")
    Item = frappe.qb.DocType("Item")
    rows = (
        frappe.qb.from_(ProductBundleItem)
        .join(ProductBundle)
        .on(ProductBundleItem.parent == ProductBundle.name)
        .left_join(Item)
        .on(Item.name == ProductBundleItem.item_code)
        .select(
            ProductBundleItem.item_code,
            Item.item_name,
            ProductBundleItem.qty,
            ProductBundleItem.uom,
        )
        .where((ProductBundle.new_item_code == item_code) & (ProductBundle.disabled == 0))
        .orderby(ProductBundleItem.idx)
    ).run(as_dict=True)
    return rows


@frappe.whitelist()
def get_item_variants(template_item_code, warehouse=None, price_list=None, customer=None):
    """Attribute-picker data for a variant template (has_variants=1): the
    template's attributes in their configured order, the set of values that
    actually appear across its existing variants (not every value the Item
    Attribute master defines — only combinations that exist as real variant
    Items are selectable), and each variant's own resolved stock/rate plus its
    attribute_value per attribute for the frontend to match a selection
    against. Mirrors ERPNext desk's own variant-selector intent, scoped to
    what the POS terminal needs.
    """
    variants = frappe.get_all(
        "Item",
        filters={"variant_of": template_item_code, "disabled": 0},
        fields=ITEM_FIELDS,
        order_by="name asc",
    )
    if not variants:
        return {"attributes": [], "variants": []}

    _attach_stock_and_rate(variants, warehouse, price_list, customer)

    template_attr_order = frappe.get_all(
        "Item Variant Attribute",
        filters={"parent": template_item_code, "parenttype": "Item"},
        fields=["attribute"],
        order_by="idx asc",
        pluck="attribute",
    )

    variant_attrs = frappe.get_all(
        "Item Variant Attribute",
        filters={"parent": ["in", [v.item_code for v in variants]], "parenttype": "Item"},
        fields=["parent", "attribute", "attribute_value"],
        order_by="idx asc",
    )
    attrs_by_variant = {}
    values_by_attr = {}
    for row in variant_attrs:
        attrs_by_variant.setdefault(row.parent, {})[row.attribute] = row.attribute_value
        if row.attribute_value:
            values_by_attr.setdefault(row.attribute, [])
            if row.attribute_value not in values_by_attr[row.attribute]:
                values_by_attr[row.attribute].append(row.attribute_value)

    for variant in variants:
        variant.attributes = attrs_by_variant.get(variant.item_code, {})

    # Attributes not present on the template's own child table (edge case —
    # shouldn't normally happen) are appended after the configured ones so no
    # variant attribute is silently dropped from the picker.
    attribute_names = list(template_attr_order) + [
        a for a in values_by_attr if a not in template_attr_order
    ]
    attributes = [
        {"attribute": attr, "values": values_by_attr.get(attr, [])} for attr in attribute_names
    ]

    return {"attributes": attributes, "variants": variants}


@frappe.whitelist()
def get_item_groups():
    """Getting All Item groups as needs for offline functionality"""
    item_groups = frappe.get_all("Item Group", filters={}, fields=["name as item_group", "image"], order_by="lft asc")
    return item_groups

@frappe.whitelist()
def get_items(item_group=None, warehouse=None, price_list=None, customer=None, pos_profile=None):
    """
    Getting All Items as needs for offline functionality.
    stock/rate are resolved from `warehouse`/`price_list` — the POS Profile
    behind the cashier's Opening Entry — and stay None until those are known.
    `pos_profile`, when given, restricts results to its configured `item_groups`
    (empty on the profile = no restriction, matching ERPNext's own convention).
    """
    # variant_of="" excludes individual variant Items (e.g. "T-Shirt-Red-M")
    # from the browse grid — a variant's own template (has_variants=1,
    # variant_of="") is shown instead, and the cashier picks the specific
    # variant via get_item_variants's attribute picker rather than needing to
    # find/know the exact variant item_code. Exact-match lookups (barcode,
    # serial no, item code) in search_item bypass this filter entirely, so a
    # scanned variant barcode still resolves straight to that variant.
    filters = {"disabled": 0, "variant_of": ["is", "not set"]}
    if item_group:

        # Checking if parent group then fetching all child groups otherwise we check only selected group
        if frappe.get_cached_value("Item Group", item_group, "is_group"):
            child_groups = frappe.get_all("Item Group", filters={"parent_item_group": item_group}, fields=["name"], order_by="lft asc")
            groups = [group.name for group in child_groups]
            groups.extend(item_group)
            filters.update({"item_group": ["in", groups]})
        else:
            filters.update({"item_group": item_group})

    allowed_groups = _allowed_item_groups(pos_profile)
    if allowed_groups is not None:
        current = filters.get("item_group")
        if current is None:
            filters["item_group"] = ["in", list(allowed_groups)]
        elif isinstance(current, list) and current[0] == "in":
            filters["item_group"] = ["in", [g for g in current[1] if g in allowed_groups]]
        elif current not in allowed_groups:
            filters["item_group"] = ["in", []]

    items = frappe.get_all(
        "Item",
        filters=filters,
        fields=ITEM_FIELDS,
        order_by="name asc",
    )
    _attach_stock_and_rate(items, warehouse, price_list, customer)
    return items


@frappe.whitelist()
def search_item(search_text, warehouse=None, price_list=None, customer=None, pos_profile=None):
    """
    Resolve a scanned/typed value against everything a cashier might key into the
    POS search box: an item barcode, a serial no, a batch no, an exact item code,
    or a fuzzy item code/name/barcode search. stock/rate are resolved the same
    way as get_items — from the warehouse/price list behind the Opening Entry.
    `pos_profile`'s `item_groups` restriction (see get_items) applies here too —
    a scanned/typed item outside the allowed groups resolves to no match.

    Returns {"match_type": "barcode"|"serial_no"|"batch_no"|"item_code"|"search", "items": [...]}
    "items" has exactly one entry for the first four (exact) match types, so the
    caller can auto-add to cart without extra clicks; "search" may return many.
    """
    search_text = (search_text or "").strip()
    if not search_text:
        return {"match_type": "search", "items": []}

    allowed_groups = _allowed_item_groups(pos_profile)

    def _allowed(item):
        return item and (allowed_groups is None or item.item_group in allowed_groups)

    # 1. Barcode — exact match on the Item's barcodes child table
    item_code = frappe.db.get_value("Item Barcode", {"barcode": search_text}, "parent")
    if item_code:
        item = _get_item(item_code, warehouse, price_list, customer)
        if _allowed(item):
            return {"match_type": "barcode", "items": [item]}

    # 2. Serial No — exact match, carries its item + batch along
    if frappe.db.exists("Serial No", search_text):
        serial = frappe.db.get_value("Serial No", search_text, ["item_code", "batch_no"], as_dict=True)
        item = _get_item(serial.item_code, warehouse, price_list, customer, serial_no=search_text, batch_no=serial.batch_no or "")
        if _allowed(item):
            return {"match_type": "serial_no", "items": [item]}

    # 3. Batch No — exact match
    if frappe.db.exists("Batch", search_text):
        batch_item = frappe.db.get_value("Batch", search_text, "item")
        item = _get_item(batch_item, warehouse, price_list, customer, batch_no=search_text)
        if _allowed(item):
            return {"match_type": "batch_no", "items": [item]}

    # 4. Item code — exact match
    if frappe.db.exists("Item", search_text):
        item = _get_item(search_text, warehouse, price_list, customer)
        if _allowed(item):
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
            Item.has_variants,
        )
        .distinct()
        .where(
            (Item.disabled == 0)
            & (IfNull(Item.variant_of, "") == "")
            & (
                Item.name.like(like)
                | Item.item_name.like(like)
                | ItemBarcode.barcode.like(like)
            )
        )
    )
    if allowed_groups is not None:
        query = query.where(Item.item_group.isin(list(allowed_groups)))
    query = query.orderby(Item.name).limit(50)
    items = query.run(as_dict=True)
    _attach_stock_and_rate(items, warehouse, price_list, customer)
    return {"match_type": "search", "items": items}
