import { engineGet, enginePost } from "../engine";

export const fetchOpeningEntry = async (user) => {
	try {
		const response = await engineGet("/api/method/easy_pos.api.pos.check_opening_entry", {
            params: {
                user
            }
        });
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const postOpeningEntry = async (opening_details) => {
	const response = await enginePost("/api/method/easy_pos.api.pos.create_opening_entry", {
        opening_details
    });
	return response.data.message;
};
