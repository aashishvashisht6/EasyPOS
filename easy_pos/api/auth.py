import frappe
from frappe.auth import LoginManager


@frappe.whitelist(allow_guest=True)
def get_csrf_token() -> str:
	"""GET endpoint (CSRF-exempt) so the SPA can pick up a valid token when it
	isn't served through Frappe's own Jinja templates, e.g. via the Vite dev server."""
	return frappe.sessions.get_csrf_token()


@frappe.whitelist(allow_guest=True)
def pos_login(usr: str, pwd: str) -> dict:
	login_manager = LoginManager()
	login_manager.authenticate(user=usr, pwd=pwd)
	login_manager.post_login()

	return {
		"user": frappe.session.user,
		"full_name": frappe.utils.get_fullname(frappe.session.user),
	}
