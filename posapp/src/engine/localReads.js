import db from "./db";

const ok = (message) => ({ data: { message } });

// Minimal subset of Frappe's filter-condition shapes actually used by the
// api/*.js call sites this module serves — {field: value} (equality) or
// {field: [operator, value]}. Extend as more call shapes get an adapter.
const opMatch = (value, op, target) => {
	switch (op) {
		case "like": {
			const needle = String(target ?? "")
				.replace(/%/g, "")
				.toLowerCase();
			return String(value ?? "")
				.toLowerCase()
				.includes(needle);
		}
		case "in":
			return (target ?? []).includes(value);
		case "not in":
			return !(target ?? []).includes(value);
		case "!=":
			return value !== target;
		case "between": {
			const [start, end] = target ?? [];
			return (!start || value >= start) && (!end || value <= end);
		}
		default:
			return value === target;
	}
};

const rowMatches = (row, conditions, mode) => {
	const entries = Object.entries(conditions || {});
	// An empty condition group (no filters, or no search term typed into
	// or_filters) applies no restriction at all — it must never exclude rows,
	// in either the AND or the OR group. Returning `mode === "and"` here used
	// to make an empty or_filters group evaluate to false, which excluded
	// every row whenever there was no active search term (i.e. almost always).
	if (!entries.length) return true;
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

// Shared shape behind every `easy_pos.api.list_view.get_list` adapter: filter
// the cached table's rows and paginate, returning the same
// { data, total_count } shape ListView.js's fetchList already expects.
const listReader =
	(table) =>
	async ({ filters, or_filters, limit_start = 0, limit_page_length = 20 } = {}) => {
		const all = await table.toArray();
		const matched = listFilter(all, filters, or_filters);
		const page = limit_page_length
			? matched.slice(limit_start, limit_start + limit_page_length)
			: matched;
		return ok({ data: page, total_count: matched.length });
	};

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
				(item.item_name ?? "").toLowerCase().includes(needle)
		)
		.slice(0, 50);
	return ok({ match_type: "search", items: matches });
};

const readItemGroups = async () => ok(await db.item_groups.toArray());

// --- Auth / shift status ---------------------------------------------------------

// Keys must match api/User.js and api/OpeningEntry.js's own cache writes.
const readLoggedInUser = async () => ok((await db.meta.get("loggedInUser"))?.email ?? null);

const readCheckOpeningEntry = async ({ user } = {}) => {
	const cached = await db.meta.get(`openingEntry:${user}`);
	return ok(cached?.data ?? {});
};

// --- Customer ------------------------------------------------------------------

const readCustomerGet = async ({ name } = {}) => ok((await db.customers.get(name)) ?? null);
const readCustomerList = listReader(db.customers);

// --- POS Profile / Tax template / Price List / Pricing Rule --------------------

const readPOSProfileGet = async ({ name } = {}) => ok((await db.pos_profiles.get(name)) ?? null);
// The POS Profile list page's own summary rows — see engine/sync.js's runFullSync
// for why this can safely share a table with the fuller single-profile doc above.
const readPOSProfileList = listReader(db.pos_profiles);

const readTaxTemplate = async () => {
	const rows = await db.taxes.toArray();
	return ok(rows[0]?.rows ?? []);
};

const readPriceListGet = async ({ name } = {}) => ok((await db.price_lists.get(name)) ?? null);
const readPriceListList = listReader(db.price_lists);

const readPricingRuleGet = async ({ name } = {}) => ok((await db.pricing_rules.get(name)) ?? null);
const readPricingRuleList = listReader(db.pricing_rules);

// --- Item Price / Loyalty Program / Sales Invoice -------------------------------

const readItemPriceGet = async ({ name } = {}) => ok((await db.item_prices.get(name)) ?? null);
const readItemPriceList = listReader(db.item_prices);

const readLoyaltyProgramGet = async ({ name } = {}) =>
	ok((await db.loyalty_programs.get(name)) ?? null);
const readLoyaltyProgramList = listReader(db.loyalty_programs);

// No Get adapter for Sales Invoice — the cached rows only carry the list
// page's summary columns (INVOICE_FIELDS), not the full doc (items, taxes,
// payments) InvoiceDetailPage needs, so a detail view still requires the
// server even when the list itself can be browsed offline.
const readInvoiceList = listReader(db.invoices);

// --- Link field autocomplete (frappe.desk.search.search_link) ------------------

// Every doctype common/LinkField.jsx can be pointed at that also has a cached
// table — most notably Cart/DraftPickerModal's Customer picker, the one
// LinkField on the actual checkout path. `fields` are matched against `txt`
// (case-insensitive substring, OR'd together); `description` mirrors what the
// real search_link puts in each result's `description` key, since callers
// across the app (Cart's renderOption, onChange handlers) read that key as
// the human-readable label. Doctypes with no entry here (Address, Contact,
// Customer Group, Territory, Warehouse, ...) aren't cached at all yet, so
// their LinkFields still require the server — same as before this adapter.
const SEARCH_LINK_SOURCES = {
	Customer: {
		table: db.customers,
		fields: ["name", "customer_name"],
		description: (r) => r.customer_name,
	},
	Item: { table: db.items, fields: ["item_code", "item_name"], description: (r) => r.item_name },
	"POS Profile": { table: db.pos_profiles, fields: ["name"], description: (r) => r.company },
	"Price List": { table: db.price_lists, fields: ["name"], description: () => undefined },
	"Pricing Rule": { table: db.pricing_rules, fields: ["name"], description: () => undefined },
	"Item Price": {
		table: db.item_prices,
		fields: ["name", "item_code", "item_name"],
		description: (r) => r.item_name,
	},
	"Loyalty Program": {
		table: db.loyalty_programs,
		fields: ["name", "loyalty_program_name"],
		description: (r) => r.loyalty_program_name,
	},
};

const readSearchLink = async ({ doctype, txt = "", filters, page_length = 20 } = {}) => {
	const source = SEARCH_LINK_SOURCES[doctype];
	if (!source) return ok([]);

	const parsedFilters = typeof filters === "string" && filters ? JSON.parse(filters) : filters;
	const needle = String(txt ?? "")
		.trim()
		.toLowerCase();

	const all = await source.table.toArray();
	const matched = all.filter((row) => {
		if (!rowMatches(row, parsedFilters, "and")) return false;
		if (!needle) return true;
		return source.fields.some((field) =>
			String(row[field] ?? "")
				.toLowerCase()
				.includes(needle)
		);
	});

	const results = matched.slice(0, page_length).map((row) => ({
		value: row.name,
		description: source.description(row) || undefined,
	}));
	return ok(results);
};

// --- Dispatch --------------------------------------------------------------------

// Each entry's `test` inspects the request's `url` (and, for shared endpoints
// like frappe.client.get, the doctype in its params/data) to decide whether a
// cached table can serve it. Only the read shapes actually exercised by the
// POS Terminal / shift-load hot path are covered — anything else has no
// adapter, so `readFromLocalDB` throws instead of silently returning nothing.
const ADAPTERS = [
	{
		test: (url) => url.endsWith("easy_pos.api.item.get_items"),
		read: (ctx) => readItems(ctx.params),
	},
	{
		test: (url) => url.endsWith("easy_pos.api.item.search_item"),
		read: (ctx) => readSearchItem(ctx.params),
	},
	{
		test: (url) => url.endsWith("easy_pos.api.item.get_item_groups"),
		read: () => readItemGroups(),
	},
	{
		test: (url) => url.endsWith("easy_pos.api.pos.get_taxes_and_charges_template"),
		read: () => readTaxTemplate(),
	},
	{ test: (url) => url.endsWith("frappe.auth.get_logged_user"), read: () => readLoggedInUser() },
	{
		test: (url, ctx) =>
			url.endsWith("frappe.desk.search.search_link") &&
			!!SEARCH_LINK_SOURCES[ctx.params?.doctype],
		read: (ctx) => readSearchLink(ctx.params),
	},
	{
		test: (url) => url.endsWith("easy_pos.api.pos.check_opening_entry"),
		read: (ctx) => readCheckOpeningEntry(ctx.params),
	},
	{
		test: (url, ctx) =>
			url.endsWith("frappe.client.get") && ctx.params?.doctype === "Customer",
		read: (ctx) => readCustomerGet(ctx.params),
	},
	{
		test: (url, ctx) =>
			url.endsWith("frappe.client.get") && ctx.params?.doctype === "POS Profile",
		read: (ctx) => readPOSProfileGet(ctx.params),
	},
	{
		test: (url, ctx) =>
			url.endsWith("frappe.client.get") && ctx.params?.doctype === "Price List",
		read: (ctx) => readPriceListGet(ctx.params),
	},
	{
		test: (url, ctx) =>
			url.endsWith("frappe.client.get") && ctx.params?.doctype === "Pricing Rule",
		read: (ctx) => readPricingRuleGet(ctx.params),
	},
	{
		test: (url, ctx) =>
			url.endsWith("frappe.client.get") && ctx.params?.doctype === "Item Price",
		read: (ctx) => readItemPriceGet(ctx.params),
	},
	{
		test: (url, ctx) =>
			url.endsWith("frappe.client.get") && ctx.params?.doctype === "Loyalty Program",
		read: (ctx) => readLoyaltyProgramGet(ctx.params),
	},
	{
		test: (url, ctx) =>
			url.endsWith("easy_pos.api.list_view.get_list") && ctx.data?.doctype === "Customer",
		read: (ctx) => readCustomerList(ctx.data),
	},
	{
		test: (url, ctx) =>
			url.endsWith("easy_pos.api.list_view.get_list") && ctx.data?.doctype === "POS Profile",
		read: (ctx) => readPOSProfileList(ctx.data),
	},
	{
		test: (url, ctx) =>
			url.endsWith("easy_pos.api.list_view.get_list") && ctx.data?.doctype === "Price List",
		read: (ctx) => readPriceListList(ctx.data),
	},
	{
		test: (url, ctx) =>
			url.endsWith("easy_pos.api.list_view.get_list") &&
			ctx.data?.doctype === "Pricing Rule",
		read: (ctx) => readPricingRuleList(ctx.data),
	},
	{
		test: (url, ctx) =>
			url.endsWith("easy_pos.api.list_view.get_list") && ctx.data?.doctype === "Item Price",
		read: (ctx) => readItemPriceList(ctx.data),
	},
	{
		test: (url, ctx) =>
			url.endsWith("easy_pos.api.list_view.get_list") &&
			ctx.data?.doctype === "Loyalty Program",
		read: (ctx) => readLoyaltyProgramList(ctx.data),
	},
	{
		test: (url, ctx) =>
			url.endsWith("easy_pos.api.list_view.get_list") &&
			ctx.data?.doctype === "Sales Invoice",
		read: (ctx) => readInvoiceList(ctx.data),
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
