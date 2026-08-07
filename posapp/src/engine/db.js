import Dexie from "dexie";

// Local offline store for the POS Terminal. Dexie databases are singletons by
// construction: importing this module anywhere returns the same open connection.
const db = new Dexie("easy_pos_offline");

// v1 was an early stub — primary-key-only schemas, never actually written to
// (see the "not implemented yet" gotcha this replaces).
db.version(1).stores({
	items: "name",
	item_groups: "name",
	customers: "name",
	price_lists: "name",
	pricing_rules: "name",
	taxes: "name",
	pos_profiles: "name",
	payment_modes: "name",
});

// v2 drops the three tables whose primary key needs to change (items,
// item_groups, taxes) — Dexie has no supported in-place migration for
// changing an existing table's primaryKey ("Not yet support for changing
// primary key", which then closes the whole DB) — the only way there is
// delete-then-recreate across two versions. Safe to drop outright: every v1
// table was an always-empty stub, never written to by any shipped code.
db.version(2).stores({
	items: null,
	item_groups: null,
	taxes: null,
});

// v3 is the real shape written by engine/sync.js's runFullSync and read by
// engine/localReads.js. customers/price_lists/pricing_rules/pos_profiles/
// payment_modes keep their v1 "name" primary key unchanged, so they don't
// need redeclaring — Dexie carries a table forward as-is when a later
// version's .stores() doesn't mention it.
db.version(3).stores({
	items: "item_code",
	item_groups: "item_group",
	// Single row keyed by template name (the POS Profile's own taxes_and_charges
	// template) — the terminal only ever needs one resolved template at a time.
	taxes: "template",
	// One row per synced domain: { key: "<sync-domain key>", lastSyncedAt: <ISO string> }.
	meta: "key",
});

export default db;
