import axios from "axios";

export const fetchItems = async (item_group) => {
	try {
		const response = await axios.get("/api/method/easy_pos.api.item.get_items", {
			params: { item_group },
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};
