import { engineGet } from "../engine";

export const fetchCompanies = async () => {
	try {
		const response = await engineGet("/api/method/frappe.desk.reportview.get_list", {
			params: {
				doctype: "Company",
				fields: JSON.stringify(["name", "company_name"]),
				limit: 200,
			},
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};
