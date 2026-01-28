import axios from "axios";

export const fetchCustomers = async () => {
	try {
		const response = await axios.get("/api/method/easy_pos.api.customer.get_customers");
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};
