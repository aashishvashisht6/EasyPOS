import { engineGet } from "../engine";

// warehouse/price_list come from the open POS Profile (posSessionStore) — until
// an Opening Entry exists neither is known, so stock/rate come back as null.
// `customer` (cart's selected customer) resolves customer-specific Item Price
// rows; `pos_profile` restricts results to the profile's configured item_groups.
export const fetchItems = async (item_group, warehouse, price_list, customer, pos_profile) => {
	try {
		const response = await engineGet("/api/method/easy_pos.api.item.get_items", {
			params: { item_group, warehouse, price_list, customer, pos_profile },
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

// Resolves a scanned/typed search string against item code, barcode, serial no,
// batch no, or a fuzzy item code/name search — see easy_pos.api.item.search_item.
export const searchItem = async (search_text, warehouse, price_list, customer, pos_profile) => {
	try {
		const response = await engineGet("/api/method/easy_pos.api.item.search_item", {
			params: { search_text, warehouse, price_list, customer, pos_profile },
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

// Read-only component list (item_code/item_name/qty/uom) of a Product Bundle
// parent item — display-only preview for the cart line detail panel; ERPNext
// itself explodes the bundle into Sales Invoice packed_items on save.
export const fetchProductBundleContents = async (item_code) => {
	try {
		const response = await engineGet("/api/method/easy_pos.api.item.get_product_bundle_contents", {
			params: { item_code },
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};
