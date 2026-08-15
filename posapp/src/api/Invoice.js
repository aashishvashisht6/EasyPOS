import { engineGet, enginePost } from "../engine";

export const fetchPrecisionSettings = async () => {
	try {
		const response = await engineGet("/api/method/easy_pos.api.pos.get_precision_settings");
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const postDraftInvoice = async (invoice, opening_details, submit, coupon_code) => {
	try {
		const response = await enginePost("/api/method/easy_pos.api.pos.create_invoice", {
			invoice,
			opening_details,
			submit,
			coupon_code,
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const postPaymentInvoice = async (invoice, opening_details, submit, coupon_code) => {
	try {
		const response = await enginePost("/api/method/easy_pos.api.pos.create_invoice", {
			invoice,
			opening_details,
			submit,
			coupon_code,
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const fetchDraftInvoices = async (pos_profile) => {
	try {
		const response = await engineGet("/api/method/frappe.desk.reportview.get_list", {
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
		const response = await engineGet("/api/method/frappe.client.get", {
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

// Errors are intentionally left to propagate (no try/catch) so callers can
// surface the backend's frappe.throw message (e.g. validation errors) in the
// UI instead of it being swallowed here.
export const cancelInvoice = async (name) => {
	const response = await enginePost("/api/method/easy_pos.api.pos.cancel_sales_invoice", {
		name,
	});
	return response.data.message;
};

export const createCreditNote = async (name, items, taxes) => {
	const response = await enginePost("/api/method/easy_pos.api.pos.create_credit_note", {
		name,
		items,
		taxes,
	});
	return response.data.message;
};
