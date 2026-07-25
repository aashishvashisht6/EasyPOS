import { engineGet } from "../engine";

export const fetchItemGroups = async () => {
	try {
		const response = await engineGet("/api/method/easy_pos.api.item.get_item_groups");
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};
