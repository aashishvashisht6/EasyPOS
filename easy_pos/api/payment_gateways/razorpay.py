"""Razorpay gateway module — implements the interface easy_pos.api.payment
dispatches to: get_config(), create_order(sales_invoice, amount), verify(sales_invoice, payload).
Wraps payments app's `Razorpay Settings` doc rather than re-implementing order
creation, since that already handles the rupee->paisa conversion and credential
storage; only the Checkout.js client-callback signature verification (distinct
from RazorpaySettings.verify_signature, which is for the async webhook payload)
is done here directly via the official `razorpay` SDK."""

import frappe


def _settings():
	return frappe.get_cached_doc("Razorpay Settings")


def get_config() -> dict:
	settings = _settings()
	enabled = bool(settings.api_key and settings.api_secret)
	return {"enabled": enabled, "key": settings.api_key or ""}


def create_order(sales_invoice, amount: float) -> dict:
	settings = _settings()
	if not (settings.api_key and settings.api_secret):
		frappe.throw("Razorpay is not configured. Set it up under Razorpay Settings first.")

	order = settings.create_order(
		amount=amount,
		currency=sales_invoice.currency,
		receipt=sales_invoice.name,
		payment_capture=1,
	)
	return {
		"order_id": order.get("id"),
		"amount": order.get("amount"),
		"currency": order.get("currency"),
		"key": settings.api_key,
	}


def verify(sales_invoice, payload: dict) -> str:
	import razorpay

	settings = _settings()
	client = razorpay.Client(auth=(settings.api_key, settings.get_password("api_secret")))

	razorpay_order_id = payload.get("razorpay_order_id")
	razorpay_payment_id = payload.get("razorpay_payment_id")
	razorpay_signature = payload.get("razorpay_signature")

	try:
		client.utility.verify_payment_signature({
			"razorpay_order_id": razorpay_order_id,
			"razorpay_payment_id": razorpay_payment_id,
			"razorpay_signature": razorpay_signature,
		})
	except razorpay.errors.SignatureVerificationError:
		frappe.throw("Razorpay payment signature verification failed")

	payment = client.payment.fetch(razorpay_payment_id)
	if payment.get("status") == "authorized":
		payment = client.payment.capture(razorpay_payment_id, payment.get("amount"))
	if payment.get("status") != "captured":
		frappe.throw(f"Razorpay payment was not captured (status: {payment.get('status')})")

	return razorpay_payment_id
