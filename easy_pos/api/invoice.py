import frappe

@frappe.whitelist()
def create_invoice(**kwargs):
    """Create Sales Invoice from this payload for the POS Customer"""
    pass