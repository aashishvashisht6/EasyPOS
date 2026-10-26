import axios from "axios";
import { getLanguage } from "../translation";

// Always send cookies (required by Frappe)
axios.defaults.withCredentials = true;

// Add CSRF token dynamically
axios.interceptors.request.use((config) => {
	if (window.csrf_token) {
		config.headers["X-Frappe-CSRF-Token"] = window.csrf_token;
	}

	// Server-side messages (frappe.throw) in the language chosen on this
	// device — applied by easy_pos.api.language.apply_request_language.
	if (getLanguage()) {
		config.headers["X-Easy-POS-Language"] = getLanguage();
	}

	// Frappe's whitelisted GET endpoints don't send cache-busting headers, so the
	// browser's HTTP cache can silently serve stale data (e.g. opening-entry status
	// right after opening/closing a shift). Force a fresh request every time.
	if ((config.method ?? "get").toLowerCase() === "get") {
		config.params = { ...config.params, _: Date.now() };
	}

	return config;
});

export default axios;
