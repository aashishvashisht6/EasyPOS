import razorpay from "./razorpay";

// Registry of gateway modules — each implements { name, pay(ctx) } where ctx is
// { invoicePayload, openingDetail, amount, couponCode } and pay() resolves with
// the finalized Sales Invoice dict, or rejects with { cancelled: true } (dismissed,
// not an error) or an Error with a user-facing message.
//
// Adding a gateway: create a module here following razorpay.js's shape, add it
// below, add its name to the POS Payment Method.ep_payment_gateway Select options
// (easy_pos/patches/add_payment_gateway_fields.py) and to the backend registry
// (easy_pos/api/payment_gateways/__init__.py). InvoicePay itself never changes.
const GATEWAYS = {
	Razorpay: razorpay,
};

export const getPaymentGateway = (name) => GATEWAYS[name];
