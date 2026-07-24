import axios from "axios";

export const fetchCurrencySymbol = async (currency) => {
	try {
		const response = await axios.get("/api/method/frappe.client.get_value", {
			params: {
				doctype: "Currency",
				fieldname: "symbol",
				filters: JSON.stringify({ name: currency }),
			},
		});
		return response.data.message?.symbol || currency;
	} catch (error) {
		console.error(error);
		return currency;
	}
};
