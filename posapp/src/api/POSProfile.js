import { engineGet, enginePost } from "../engine";
import { fetchList } from "./ListView";

const PROFILE_FIELDS = ["name", "company", "warehouse", "selling_price_list", "disabled"];

export const fetchProfiles = async (filters = {}, limit_start = 0, limit_page_length = 20) => {
	const conditions = {};
	const orConditions = {};

	if (filters.status === "Active") conditions.disabled = 0;
	else if (filters.status === "Disabled") conditions.disabled = 1;
	if (filters.company) conditions.company = filters.company;
	if (filters.search) {
		const term = `%${filters.search}%`;
		orConditions.name = ["like", term];
		orConditions.warehouse = ["like", term];
	}

	const data = await fetchList("POS Profile", {
		fields: PROFILE_FIELDS,
		filters: conditions,
		or_filters: orConditions,
		order_by: "name asc",
		limit_start,
		limit_page_length,
	});

	return { profiles: data?.data ?? [], total_count: data?.total_count ?? 0 };
};

// Flat list of enabled POS Profiles for a company — used by the Opening Entry
// flow's dropdown, distinct from fetchProfiles' paginated {profiles, total_count}
// shape (which is for the POS Profile list page).
export const fetchProfilesForCompany = async (company) => {
	try {
		const response = await engineGet("/api/method/frappe.desk.reportview.get_list", {
			params: {
				doctype: "POS Profile",
				filters: JSON.stringify({ company, disabled: 0 }),
				fields: JSON.stringify(["name"]),
				limit: 100,
			},
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const fetchProfile = async (pos_profile) => {
	try {
		const response = await engineGet("/api/method/frappe.client.get", {
			params: {
				doctype: "POS Profile",
				name: pos_profile,
			},
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const createProfile = async (profile) => {
	const response = await enginePost("/api/method/frappe.client.insert", {
		doc: JSON.stringify({ doctype: "POS Profile", ...profile }),
	});
	return response.data.message;
};

export const saveProfile = async (profile) => {
	const response = await enginePost("/api/method/frappe.client.save", {
		doc: JSON.stringify({ doctype: "POS Profile", ...profile }),
	});
	return response.data.message;
};

// Mirrors pos_profile.js's `company` trigger (erpnext.utils.set_letter_head +
// erpnext.is_perpetual_inventory_enabled), which reads the Company's default
// letter head and perpetual-inventory flag whenever the profile's Company changes.
export const fetchCompanyDefaults = async (company) => {
	try {
		const response = await engineGet("/api/method/frappe.client.get_value", {
			params: {
				doctype: "Company",
				fieldname: JSON.stringify(["default_letter_head", "enable_perpetual_inventory"]),
				filters: JSON.stringify({ name: company }),
			},
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};
