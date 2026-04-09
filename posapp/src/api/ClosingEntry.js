import axios from "axios";

export const fetchClosingEntry = async (opening_details) => {
	try {
		const response = await axios.post("/api/method/easy_pos.api.pos.get_closing_entry", {
            opening_details
        });
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const postClosingEntry = async (closing_details) => {
	try {
		const response = await axios.post("/api/method/easy_pos.api.pos.create_closing_entry", {
            closing_details
        });
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};