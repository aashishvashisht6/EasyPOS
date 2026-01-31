import axios from "axios";

export const fetchProfiles = async (company) => {
	try {
		const response = await axios.get("/api/method/frappe.desk.reportview.get_list", {
            params: {
                doctype: "POS Profile",
                filters: JSON.stringify({company}),
                fields: JSON.stringify(["name"]),
                limit: 200
            }
        });
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const fetchProfile = async (pos_profile) => {
	try {
		const response = await axios.get("/api/method/frappe.client.get", {
            params: {
                doctype: "POS Profile",
                name: pos_profile
            }
        });
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};
