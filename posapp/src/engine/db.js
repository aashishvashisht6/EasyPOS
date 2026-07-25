import Dexie from "dexie";

// Local offline store for the POS Terminal. Table list mirrors the data
// domains the Terminal needs to operate offline (catalog, customers, pricing,
// shift config) — schemas are intentionally minimal (primary key only) since
// the bulk-fetch/sync logic that decides the real field shape hasn't landed
// yet. Dexie databases are singletons by construction: importing this module
// anywhere returns the same open connection.
const db = new Dexie("easy_pos_offline");

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

export default db;
