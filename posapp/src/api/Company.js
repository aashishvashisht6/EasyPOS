import axios from "axios";

export const fetchCompanies = async (user) => {
	try {
		const response = await axios.get("/api/method/frappe.desk.reportview.get_list", {
            params: {
                doctype: "Company",
                fields: JSON.stringify(["name", "company_name"]),
                limit: 200
            }
        });
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};
