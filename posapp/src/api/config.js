import axios from "axios";

// Always send cookies (required by Frappe)
axios.defaults.withCredentials = true;

// Add CSRF token dynamically
axios.interceptors.request.use((config) => {
	if (window.csrf_token) {
		config.headers["X-Frappe-CSRF-Token"] = window.csrf_token;
	}
	return config;
});

export default axios;