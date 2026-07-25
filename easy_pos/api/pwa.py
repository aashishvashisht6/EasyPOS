import frappe
from werkzeug.wrappers import Response


@frappe.whitelist(allow_guest=True)
def service_worker():
	"""Serve the built PWA service worker with a Service-Worker-Allowed header.

	The SPA lives under /posapp/* but the built sw.js is emitted alongside the
	rest of the Vite bundle under /assets/easy_pos/posapp/ - a worker's default
	scope is limited to the directory it's served from, so it can't control
	/posapp/* pages from that asset URL. Serving it here instead (with the
	Service-Worker-Allowed header) lets the frontend register it with an
	explicit scope of /posapp/ regardless of where the bytes come from.
	"""
	sw_path = frappe.get_app_path("easy_pos", "public", "posapp", "sw.js")

	try:
		with open(sw_path, "rb") as f:
			content = f.read()
	except FileNotFoundError:
		frappe.throw("Service worker not built yet - run `yarn build` in posapp/", frappe.NotFound)

	response = Response(content, mimetype="text/javascript")
	response.headers["Service-Worker-Allowed"] = "/posapp/"
	response.headers["Cache-Control"] = "no-cache"
	return response
