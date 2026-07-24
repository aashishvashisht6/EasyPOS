import axios from "axios";

/**
 * Mirrors what Frappe desk's own Link field calls (frappe.desk.search.search_link),
 * so autocomplete behaves identically to the ERPNext/Frappe desk UI.
 */
export const searchLink = async (doctype, txt = "", filters = {}, pageLength = 20) => {
	try {
		const response = await axios.get("/api/method/frappe.desk.search.search_link", {
			params: {
				doctype,
				txt,
				filters: JSON.stringify(filters),
				page_length: pageLength,
			},
		});
		return response.data.message ?? [];
	} catch (error) {
		console.error(error);
		return [];
	}
};
