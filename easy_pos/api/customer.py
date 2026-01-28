import frappe

@frappe.whitelist()
def get_customers():
    """Getting All Customers but need to improve this one as in future we will add offline functionality"""
    customers = frappe.get_all("Customer", filters={"disabled": 0}, 
                               fields=["name", "customer_name", "mobile_no", "email_id"], 
                               order_by="customer_name asc")
    
    for customer in customers:
        customer.mobile_no = customer.mobile_no or ""
        customer.email_id = customer.email_id or ""
        
        orders = frappe.get_all("Sales Order", filters={"customer": customer.id},limit=20,  
                       order_by="transaction_date desc")
        customer.total_orders = len(orders) if len(orders)<20 else '20+'
    
    return customers