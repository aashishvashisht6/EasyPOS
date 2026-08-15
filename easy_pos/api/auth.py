import frappe
from frappe.auth import LoginManager


# Deliberately guest-accessible: this only hands back a CSRF token (needed
# before a session exists, e.g. served via the Vite dev server rather than
# Frappe's own Jinja templates), never any authenticated data.
@frappe.whitelist(allow_guest=True)  # nosemgrep: guest-whitelisted-method
def get_csrf_token() -> str:
	"""GET endpoint (CSRF-exempt) so the SPA can pick up a valid token when it
	isn't served through Frappe's own Jinja templates, e.g. via the Vite dev server."""
	return frappe.sessions.get_csrf_token()


# Deliberately guest-accessible: this *is* the login endpoint — a session
# can't exist yet when a cashier is authenticating. Credentials are verified
# via Frappe's own LoginManager before any session/user data is returned.
@frappe.whitelist(allow_guest=True)  # nosemgrep: guest-whitelisted-method
def pos_login(usr: str, pwd: str) -> dict:
	login_manager = LoginManager()
	login_manager.authenticate(user=usr, pwd=pwd)
	login_manager.post_login()

	return {
		"user": frappe.session.user,
		"full_name": frappe.utils.get_fullname(frappe.session.user),
	}
