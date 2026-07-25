import { engineGet, enginePost } from "../engine";
import { fetchList } from "./ListView";

const ITEM_PRICE_FIELDS = [
	"name",
	"item_code",
	"item_name",
	"price_list",
	"price_list_rate",
	"currency",
	"uom",
	"selling",
	"buying",
	"valid_from",
	"valid_upto",
];

export const fetchItemPrices = async (filters = {}, limit_start = 0, limit_page_length = 20) => {
	const conditions = {};
	const orConditions = {};

	if (filters.price_list) conditions.price_list = filters.price_list;
	if (filters.selling === "Selling") conditions.selling = 1;
	else if (filters.selling === "Buying") conditions.buying = 1;
	if (filters.search) {
		const term = `%${filters.search}%`;
		orConditions.item_code = ["like", term];
		orConditions.item_name = ["like", term];
	}

	const data = await fetchList("Item Price", {
		fields: ITEM_PRICE_FIELDS,
		filters: conditions,
		or_filters: orConditions,
		order_by: "modified desc",
		limit_start,
		limit_page_length,
	});

	return { itemPrices: data?.data ?? [], total_count: data?.total_count ?? 0 };
};

export const fetchItemPrice = async (name) => {
	try {
		const response = await engineGet("/api/method/frappe.client.get", {
			params: { doctype: "Item Price", name },
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const createItemPrice = async (itemPrice) => {
	const response = await enginePost("/api/method/frappe.client.insert", {
		doc: JSON.stringify({ doctype: "Item Price", ...itemPrice }),
	});
	return response.data.message;
};

export const saveItemPrice = async (itemPrice) => {
	const response = await enginePost("/api/method/frappe.client.save", {
		doc: JSON.stringify({ doctype: "Item Price", ...itemPrice }),
	});
	return response.data.message;
};

// Mirrors item_price.js's onload() add_fetch calls: Item Price's item_name/uom
// and buying/selling/currency are fetch_from Item/Price List respectively.
export const fetchItemDetails = async (item_code) => {
	try {
		const response = await engineGet("/api/method/frappe.client.get_value", {
			params: {
				doctype: "Item",
				fieldname: JSON.stringify(["item_name", "stock_uom"]),
				filters: JSON.stringify({ name: item_code }),
			},
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const fetchPriceListDetails = async (price_list) => {
	try {
		const response = await engineGet("/api/method/frappe.client.get_value", {
			params: {
				doctype: "Price List",
				fieldname: JSON.stringify(["buying", "selling", "currency"]),
				filters: JSON.stringify({ name: price_list }),
			},
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const fetchPriceListOptions = async () => {
	try {
		const response = await engineGet("/api/method/frappe.desk.reportview.get_list", {
			params: {
				doctype: "Price List",
				fields: JSON.stringify(["name"]),
				limit: 200,
			},
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};
