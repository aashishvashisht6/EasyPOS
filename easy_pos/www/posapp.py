import frappe
from frappe.utils import get_system_timezone

no_cache = 1


def get_context(context):
	# Get CSRF token first to ensure session is initialized
	csrf_token = frappe.sessions.get_csrf_token()
	frappe.db.commit()  # nosemgrep

	boot = frappe._dict()
	boot["csrf_token"] = csrf_token  # Also set at root level


	context.update({
		"build_version": frappe.utils.get_build_version(),
		"csrf_token": csrf_token,
	})

	context["app_name"] = "Easy POS"
	context["boot"] = get_boot()

	return context





def get_boot():
	return {
			"site_name": frappe.local.site,
			"system_timezone": get_system_timezone(),
		}