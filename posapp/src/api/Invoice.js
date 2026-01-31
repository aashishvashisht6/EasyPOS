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