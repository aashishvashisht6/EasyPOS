import frappe

from . import razorpay as razorpay_gateway

# Adding a gateway = a new module here implementing get_config/create_order/verify
# (see razorpay.py for the shape) + one line in this registry. easy_pos.api.payment
# and the frontend's PaymentGateways registry both dispatch off the same
# POS Payment Method.ep_payment_gateway value, so nothing else needs to change.
GATEWAYS = {
	"Razorpay": razorpay_gateway,
}


def get_gateway(gateway: str):
	module = GATEWAYS.get(gateway)
	if not module:
		frappe.throw(f"Unknown payment gateway: {gateway}")
	return module
