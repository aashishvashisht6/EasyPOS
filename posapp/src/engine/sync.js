import db from "./db";
import { fetchOfflineSnapshot } from "../api/Sync";
import { __, _t } from "../translation";

// One entry per Dexie table a full sync writes, in the shape the Sync page
// needs to list "what master data is cached" and its last-synced time.
export const SYNC_DOMAINS = [
	{ key: "items", label: _t("Item") },
	{ key: "item_groups", label: _t("Item Group") },
	{ key: "customers", label: _t("Customer") },
	{ key: "price_lists", label: _t("Price List") },
	{ key: "pricing_rules", label: _t("Pricing Rule") },
	{ key: "taxes", label: _t("Sales Taxes and Charges Template") },
	{ key: "pos_profiles", label: _t("POS Profile") },
	{ key: "payment_modes", label: _t("Mode of Payment") },
	{ key: "item_prices", label: _t("Item Price") },
	{ key: "loyalty_programs", label: _t("Loyalty Program") },
	{ key: "invoices", label: _t("Sales Invoice") },
	{ key: "serial_nos", label: _t("Serial No") },
	{ key: "batches", label: _t("Batch") },
];

const TABLES = {
	items: db.items,
	item_groups: db.item_groups,
	customers: db.customers,
	price_lists: db.price_lists,
	pricing_rules: db.pricing_rules,
	taxes: db.taxes,
	pos_profiles: db.pos_profiles,
	payment_modes: db.payment_modes,
	item_prices: db.item_prices,
	loyalty_programs: db.loyalty_programs,
	invoices: db.invoices,
	serial_nos: db.serial_nos,
	batches: db.batches,
};

// Pulls one full master-data snapshot for `posProfile` from the server and
// bulk-writes it into Dexie, stamping a lastSyncedAt per domain in the `meta`
// table. Doesn't check connectivity itself — callers (Sync page's Fetch
// button, posSessionStore's shift-open hook) decide when it's safe to call.
export const runFullSync = async (posProfile) => {
	const snapshot = await fetchOfflineSnapshot(posProfile);
	if (!snapshot) throw new Error(__("Could not reach the server to sync."));

	const syncedAt = snapshot.synced_at || new Date().toISOString();

	await db.transaction("rw", [...Object.values(TABLES), db.meta], async () => {
		await TABLES.items.clear();
		await TABLES.items.bulkPut(snapshot.items ?? []);
		await TABLES.item_groups.clear();
		await TABLES.item_groups.bulkPut(snapshot.item_groups ?? []);
		await TABLES.customers.clear();
		await TABLES.customers.bulkPut(snapshot.customers ?? []);
		await TABLES.price_lists.clear();
		await TABLES.price_lists.bulkPut(snapshot.price_lists ?? []);
		await TABLES.pricing_rules.clear();
		await TABLES.pricing_rules.bulkPut(snapshot.pricing_rules ?? []);
		await TABLES.taxes.clear();
		if (snapshot.taxes?.template) await TABLES.taxes.put(snapshot.taxes);
		// Company-wide profile summaries first (for the POS Profile list page),
		// then overwrite this shift's own profile with its full doc (same "name"
		// primary key) — the terminal needs the fuller record, the list page only
		// needs the summary fields.
		await TABLES.pos_profiles.clear();
		await TABLES.pos_profiles.bulkPut(snapshot.pos_profiles ?? []);
		if (snapshot.pos_profile) await TABLES.pos_profiles.put(snapshot.pos_profile);
		await TABLES.payment_modes.clear();
		await TABLES.payment_modes.bulkPut(snapshot.modes_of_payment ?? []);
		await TABLES.item_prices.clear();
		await TABLES.item_prices.bulkPut(snapshot.item_prices ?? []);
		await TABLES.loyalty_programs.clear();
		await TABLES.loyalty_programs.bulkPut(snapshot.loyalty_programs ?? []);
		await TABLES.invoices.clear();
		await TABLES.invoices.bulkPut(snapshot.invoices ?? []);
		await TABLES.serial_nos.clear();
		await TABLES.serial_nos.bulkPut(snapshot.serial_nos ?? []);
		await TABLES.batches.clear();
		await TABLES.batches.bulkPut(snapshot.batches ?? []);
		await db.meta.bulkPut(
			SYNC_DOMAINS.map((domain) => ({ key: domain.key, lastSyncedAt: syncedAt }))
		);
	});

	return { syncedAt };
};

// { [domainKey]: ISO string | undefined } — read by the Sync page.
export const getLastSyncedTimes = async () => {
	const rows = await db.meta.toArray();
	return Object.fromEntries(rows.map((row) => [row.key, row.lastSyncedAt]));
};

// Row counts per domain — read by the Sync page to show "what's cached".
export const getDomainCounts = async () => {
	const counts = await Promise.all(SYNC_DOMAINS.map((domain) => TABLES[domain.key].count()));
	return Object.fromEntries(SYNC_DOMAINS.map((domain, idx) => [domain.key, counts[idx]]));
};
