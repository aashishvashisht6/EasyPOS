import axios from "axios";

export const fetchItems = async () => {
	try {
		const response = await axios.get("/api/method/easy_pos.api.item.get_items");
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};
