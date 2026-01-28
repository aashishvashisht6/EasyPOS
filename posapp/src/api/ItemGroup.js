import axios from "axios";

export const fetchItemGroups = async () => {
	try {
		const response = await axios.get("/api/method/easy_pos.api.item.get_item_groups");
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};
