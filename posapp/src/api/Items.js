import axios from "axios";

// warehouse/price_list come from the open POS Profile (posSessionStore) — until
// an Opening Entry exists neither is known, so stock/rate come back as null.
export const fetchItems = async (item_group, warehouse, price_list) => {
	try {
		const response = await axios.get("/api/method/easy_pos.api.item.get_items", {
			params: { item_group, warehouse, price_list },
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

// Resolves a scanned/typed search string against item code, barcode, serial no,
// batch no, or a fuzzy item code/name search — see easy_pos.api.item.search_item.
export const searchItem = async (search_text, warehouse, price_list) => {
	try {
		const response = await axios.get("/api/method/easy_pos.api.item.search_item", {
			params: { search_text, warehouse, price_list },
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};
