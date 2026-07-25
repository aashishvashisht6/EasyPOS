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

// Mirrors pricing_rule.js's for_price_list get_query (filtered by selling/buying/currency).
export const fetchPriceListsFor = async ({ selling, buying, currency } = {}) => {
	try {
		const filters = {};
		if (selling) filters.selling = 1;
		if (buying) filters.buying = 1;
		if (currency) filters.currency = currency;
		const response = await axios.get("/api/method/frappe.desk.reportview.get_list", {
			params: {
				doctype: "Price List",
				filters: JSON.stringify(filters),
				fields: JSON.stringify(["name", "currency"]),
				limit: 200,
			},
		});
		return response.data.message;
	} catch (error) {
		console.error(error);
	}
};

// Mirrors pricing_rule.py's validate_price_list_with_currency (Price List's own currency).
export const fetchPriceListCurrency = async (price_list) => {
	try {
		const response = await axios.get("/api/method/frappe.client.get_value", {
			params: {
				doctype: "Price List",
				fieldname: JSON.stringify(["currency"]),
				filters: JSON.stringify({ name: price_list }),
			},
		});
		return response.data.message?.currency;
	} catch (error) {
		console.error(error);
	}
};

// Mirrors pricing_rule.js's setup() get_query on each row's UOM field: restricts
// the UOM choices to the ones actually defined in the item's UOM Conversion
// Detail table, instead of a free-form UOM link — picking an unrelated UOM
// here silently breaks rate/qty conversion when the rule is applied at billing.
export const fetchItemUoms = async (item_code) => {
	try {
		const response = await axios.get("/api/method/frappe.client.get", {
			params: { doctype: "Item", name: item_code },
		});
		const item = response.data.message;
		const uoms = (item?.uoms ?? []).map((r) => r.uom);
		if (item?.stock_uom && !uoms.includes(item.stock_uom)) uoms.push(item.stock_uom);
		return uoms;
	} catch (error) {
		console.error(error);
		return [];
	}
};

// Mirrors pricing_rule.py's validate_max_discount (per-item max_discount) and
// validate_template_with_variant (template + variant in the same rule).
export const fetchItemsValidationData = async (item_codes) => {
	if (!item_codes?.length) return [];
	try {
		const response = await axios.get("/api/method/frappe.client.get_list", {
			params: {
				doctype: "Item",
				filters: JSON.stringify([["name", "in", item_codes]]),
				fields: JSON.stringify(["name", "max_discount", "variant_of"]),
				limit_page_length: 0,
			},
		});
		return response.data.message ?? [];
	} catch (error) {
		console.error(error);
		return [];
	}
};
