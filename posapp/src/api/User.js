import axios from "axios";

export const fetchLoggedInUser = async () => {
	try {
		const response = await axios.get("/api/method/frappe.auth.get_logged_user");
		return response.data.message;
	} catch (error) {
		console.error(error);
        return null;
	}
};

export const logOutUser = async () => {
	try {
		const response = await axios.post("/api/method/logout");
		return response.data.message;
	} catch (error) {
		console.error(error);
        return null;
	}
};
