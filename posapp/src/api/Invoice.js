import axios from "axios";

export const postDraftInvoice = async (invoice, opening_details, submit) => {
	try {
		const response = await axios.post("/api/method/easy_pos.api.pos.create_invoice", {
            invoice, opening_details, submit
        });
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const postPaymentInvoice = async (invoice, opening_details, submit) => {
	try {
		const response = await axios.post("/api/method/easy_pos.api.pos.create_invoice", {
            invoice, opening_details, submit
        });
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const fetchDraftInvoices = async (pos_profile) => {
	try {
		const response = await axios.get("/api/method/frappe.desk.reportview.get_list", {
			params: {
				doctype: "Sales Invoice",
				filters: JSON.stringify({ docstatus: 0, pos_profile }),
				fields: JSON.stringify(["name", "customer", "grand_total"]),
				limit: 50,
				order_by: "modified desc",
			},
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const fetchInvoice = async (name) => {
	try {
		const response = await axios.get("/api/method/frappe.client.get", {
			params: {
				doctype: "Sales Invoice",
				name,
			},
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};
