import { engineGet, enginePost } from "../engine";

export const fetchLoggedInUser = async () => {
	try {
		const response = await engineGet("/api/method/frappe.auth.get_logged_user");
		return response.data.message;
	} catch (error) {
		console.error(error);
        return null;
	}
};

export const logOutUser = async () => {
	try {
		const response = await enginePost("/api/method/logout");
		return response.data.message;
	} catch (error) {
		console.error(error);
        return null;
	}
};
