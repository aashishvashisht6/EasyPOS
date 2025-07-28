import frappe

@frappe.whitelist()
def get_customers():
    customers = frappe.get_all("Customer", filters={"disabled": 0}, 
                               fields=["name as id", "customer_name as name", "mobile_no", "email_id"], 
                               order_by="customer_name asc")
    
    for customer in customers:
        customer.mobile_no = customer.mobile_no or ""
        customer.email_id = customer.email_id or ""
        # frappe.qb.from_("Loyalty Point Entry").select("transaction_date").where(
        orders = frappe.get_all("Sales Order", filters={"customer": customer.id},limit=20,  
                       order_by="transaction_date desc")
        customer.totalOrders = len(orders) if len(orders)<20 else '20+'
        customer.loyaltyPoints = 100
    
    return customers