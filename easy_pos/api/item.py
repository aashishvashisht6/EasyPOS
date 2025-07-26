import frappe

@frappe.whitelist()
def get_item_groups():
    return frappe.get_all("Item Group", filters={"is_group":0}, fields=["name", "image"])

@frappe.whitelist()
def get_items(item_group=None):
    filters = {"disabled":0, "has_variants":0}
    if item_group:
        filters.update({"item_group": item_group})
    items = frappe.get_all("Item", filters=filters, fields=["name", "item_name", "description", "item_group", "image"], order_by="name asc")
    for item in items:
        item.stock = 100
        item.rate = 100
    return items