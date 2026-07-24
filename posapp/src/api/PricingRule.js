import axios from "axios";
import { fetchList } from "./ListView";

const PRICING_RULE_FIELDS = [
	"name",
	"title",
	"apply_on",
	"price_or_product_discount",
	"rate_or_discount",
	"discount_percentage",
	"discount_amount",
	"selling",
	"buying",
	"priority",
	"disable",
	"valid_from",
	"valid_upto",
];

export const fetchPricingRules = async (filters = {}, limit_start = 0, limit_page_length = 20) => {
	const conditions = {};
	const orConditions = {};

	if (filters.status === "Active") conditions.disable = 0;
	else if (filters.status === "Disabled") conditions.disable = 1;
	if (filters.search) {
		orConditions.title = ["like", `%${filters.search}%`];
	}

	const data = await fetchList("Pricing Rule", {
		fields: PRICING_RULE_FIELDS,
		filters: conditions,
		or_filters: orConditions,
		order_by: "modified desc",
		limit_start,
		limit_page_length,
	});

	return { pricingRules: data?.data ?? [], total_count: data?.total_count ?? 0 };
};

export const fetchPricingRule = async (name) => {
	try {
		const response = await axios.get("/api/method/frappe.client.get", {
			params: {
				doctype: "Pricing Rule",
				name,
			},
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

export const createPricingRule = async (pricingRule) => {
	const response = await axios.post("/api/method/frappe.client.insert", {
		doc: JSON.stringify({ doctype: "Pricing Rule", ...pricingRule }),
	});
	return response.data.message;
};

export const savePricingRule = async (pricingRule) => {
	const response = await axios.post("/api/method/frappe.client.save", {
		doc: JSON.stringify({ doctype: "Pricing Rule", ...pricingRule }),
	});
	return response.data.message;
};
