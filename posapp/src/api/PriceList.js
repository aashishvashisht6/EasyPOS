import { engineGet, enginePost } from "../engine";
import { fetchList } from "./ListView";

const PRICE_LIST_FIELDS = ["name", "price_list_name", "currency", "buying", "selling", "enabled"];

export const fetchPriceLists = async (filters = {}, limit_start = 0, limit_page_length = 20) => {
	const conditions = {};
	const orConditions = {};

	if (filters.status === "Active") conditions.enabled = 1;
	else if (filters.status === "Disabled") conditions.enabled = 0;
	if (filters.search) {
		orConditions.price_list_name = ["like", `%${filters.search}%`];
	}

	const data = await fetchList("Price List", {
		fields: PRICE_LIST_FIELDS,
		filters: conditions,
		or_filters: orConditions,
		order_by: "price_list_name asc",
		limit_start,
		limit_page_length,
	});

	return { priceLists: data?.data ?? [], total_count: data?.total_count ?? 0 };
};

export const fetchPriceList = async (name) => {
	try {
		const response = await engineGet("/api/method/frappe.client.get", {
			params: { doctype: "Price List", name },
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const createPriceList = async (priceList) => {
	const response = await enginePost("/api/method/frappe.client.insert", {
		doc: JSON.stringify({ doctype: "Price List", ...priceList }),
	});
	return response.data.message;
};

export const savePriceList = async (priceList) => {
	const response = await enginePost("/api/method/frappe.client.save", {
		doc: JSON.stringify({ doctype: "Price List", ...priceList }),
	});
	return response.data.message;
};
