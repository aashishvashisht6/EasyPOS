import db from "./db";

const ok = (message) => ({ data: { message } });

// Minimal subset of Frappe's filter-condition shapes actually used by the
// api/*.js call sites this module serves — {field: value} (equality) or
// {field: [operator, value]}. Extend as more call shapes get an adapter.
const opMatch = (value, op, target) => {
	switch (op) {
		case "like": {
			const needle = String(target ?? "").replace(/%/g, "").toLowerCase();
			return String(value ?? "").toLowerCase().includes(needle);
		}
		case "in":
			return (target ?? []).includes(value);
		case "not in":
			return !(target ?? []).includes(value);
		case "!=":
			return value !== target;
		default:
			return value === target;
	}
};

const rowMatches = (row, conditions, mode) => {
	const entries = Object.entries(conditions || {});
	if (!entries.length) return mode === "and";
	const results = entries.map(([field, cond]) => {
		const [op, target] = Array.isArray(cond) ? cond : ["=", cond];
		return opMatch(row[field], op, target);
	});
	return mode === "and" ? results.every(Boolean) : results.some(Boolean);
};

// filters are AND'd together, or_filters are OR'd together, and the two
// groups are AND'd with each other — matches easy_pos.api.list_view.get_list's
// own frappe.get_list(filters=..., or_filters=...) semantics.
const listFilter = (rows, filters, orFilters) =>
	rows.filter((row) => rowMatches(row, filters, "and") && rowMatches(row, orFilters, "or"));

// --- Item catalog ------------------------------------------------------------

const readItems = async ({ item_group } = {}) => {
	let items = await db.items.toArray();
	// Exact-group match only — unlike easy_pos.api.item.get_items, there's no
	// parent/child group expansion offline (the cached item_groups rows don't
	// carry the hierarchy needed to walk descendants).
	if (item_group) items = items.filter((item) => item.item_group === item_group);
	return ok(items);
};

const readSearchItem = async ({ search_text } = {}) => {
	const text = (search_text || "").trim();
	if (!text) return ok({ match_type: "search", items: [] });

	const items = await db.items.toArray();
	const exact = items.find((item) => item.item_code === text);
	if (exact) return ok({ match_type: "item_code", items: [exact] });

	// No barcode/serial/batch match offline — ITEM_FIELDS (and thus this cached
	// snapshot) doesn't carry those rows, only item_code/item_name.
	const needle = text.toLowerCase();
	const matches = items
		.filter(
			(item) =>
				item.item_code.toLowerCase().includes(needle) ||
				(item.item_name ?? "").toLowerCase().includes(needle),
		)
		.slice(0, 50);
	return ok({ match_type: "search", items: matches });
};

const readItemGroups = async () => ok(await db.item_groups.toArray());

// --- Customer ------------------------------------------------------------------

const readCustomerGet = async ({ name } = {}) => ok((await db.customers.get(name)) ?? null);

const readCustomerList = async ({ filters, or_filters, limit_start = 0, limit_page_length = 20 } = {}) => {
	const all = await db.customers.toArray();
	const matched = listFilter(all, filters, or_filters);
	const page = limit_page_length ? matched.slice(limit_start, limit_start + limit_page_length) : matched;
	return ok({ data: page, total_count: matched.length });
};

// --- POS Profile / Tax template / Price List / Pricing Rule --------------------

const readPOSProfileGet = async ({ name } = {}) => ok((await db.pos_profiles.get(name)) ?? null);

const readTaxTemplate = async () => {
	const rows = await db.taxes.toArray();
	return ok(rows[0]?.rows ?? []);
};

const readPriceListGet = async ({ name } = {}) => ok((await db.price_lists.get(name)) ?? null);

const readPricingRuleGet = async ({ name } = {}) => ok((await db.pricing_rules.get(name)) ?? null);

// --- Dispatch --------------------------------------------------------------------

// Each entry's `test` inspects the request's `url` (and, for shared endpoints
// like frappe.client.get, the doctype in its params/data) to decide whether a
// cached table can serve it. Only the read shapes actually exercised by the
// POS Terminal / shift-load hot path are covered — anything else has no
// adapter, so `readFromLocalDB` throws instead of silently returning nothing.
const ADAPTERS = [
	{ test: (url) => url.endsWith("easy_pos.api.item.get_items"), read: (ctx) => readItems(ctx.params) },
	{ test: (url) => url.endsWith("easy_pos.api.item.search_item"), read: (ctx) => readSearchItem(ctx.params) },
	{ test: (url) => url.endsWith("easy_pos.api.item.get_item_groups"), read: () => readItemGroups() },
	{
		test: (url) => url.endsWith("easy_pos.api.pos.get_taxes_and_charges_template"),
		read: () => readTaxTemplate(),
	},
	{
		test: (url, ctx) => url.endsWith("frappe.client.get") && ctx.params?.doctype === "Customer",
		read: (ctx) => readCustomerGet(ctx.params),
	},
	{
		test: (url, ctx) => url.endsWith("frappe.client.get") && ctx.params?.doctype === "POS Profile",
		read: (ctx) => readPOSProfileGet(ctx.params),
	},
	{
		test: (url, ctx) => url.endsWith("frappe.client.get") && ctx.params?.doctype === "Price List",
		read: (ctx) => readPriceListGet(ctx.params),
	},
	{
		test: (url, ctx) => url.endsWith("frappe.client.get") && ctx.params?.doctype === "Pricing Rule",
		read: (ctx) => readPricingRuleGet(ctx.params),
	},
	{
		test: (url, ctx) => url.endsWith("easy_pos.api.list_view.get_list") && ctx.data?.doctype === "Customer",
		read: (ctx) => readCustomerList(ctx.data),
	},
];

const findAdapter = (url, ctx) => ADAPTERS.find((adapter) => adapter.test(url, ctx));

export const canServeLocally = (url, ctx) => !!findAdapter(url, ctx);

export const readFromLocalDB = async ({ url, params, data }) => {
	const ctx = { params: params || {}, data: data || {} };
	const adapter = findAdapter(url, ctx);
	if (!adapter) throw new Error(`Offline read not implemented for ${url}`);
	return adapter.read(ctx);
};
