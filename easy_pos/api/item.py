import frappe

@frappe.whitelist()
def get_item_groups():
    """Getting All Item groups as needs for offline functionality"""
    item_groups = frappe.get_all("Item Group", filters={}, fields=["name as item_group", "image"], order_by="lft asc")
    # for group in item_groups:
    #     if not group.image:
    #         group['image'] = "https://dreamspos.dreamstechnologies.com/html/template/assets/img/products/pos-product-01.png"
    return item_groups

@frappe.whitelist()
def get_items(item_group=None):
    """Getting All Items as needs for offline functionality"""
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

    items = frappe.get_all("Item", filters=filters, fields=["name as item_code", "item_name", "description", "item_group", "image"], order_by="name asc")
    for item in items:
        # if not item.image:
        #     item.image = "https://dreamspos.dreamstechnologies.com/html/template/assets/img/products/pos-product-01.png"
        item.stock = 100
        item.rate = 100
    return items