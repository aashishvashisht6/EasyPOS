# Offline-First POS — Implementation Plan

Status: **Phase 1 of 3 shipped and verified (2026-08-08)**. Phases 2–3 are planned but not started. This is the working plan for [UPCOMING_FEATURES.md](UPCOMING_FEATURES.md)'s item #12 (Offline & Sync) — kept as its own doc rather than folded into that one-paragraph entry because the feature spans multiple sessions and needs a durable record of what shipped, what's next, and the gotchas hit along the way.

## Context

Target architecture (per [`CLAUDE.md`](../CLAUDE.md)) is offline-first; the shipped build was online-only, and `SyncPage.jsx` was an explicit UI-only mock (hardcoded doctype list, fake pending counts, `setTimeout`-faked buttons). Before this plan started, the team had already landed real scaffolding for it — `posapp/src/engine/{index.js,db.js,settingsStore.js}` — which intercepts every `api/*.js` call through `engineGet`/`enginePost` instead of raw axios, gated by an `EASYPOS Settings.enable_offline_mode` checkbox. But the local-DB branch was a stub: `readFromLocalDB()` just threw, and Dexie's tables were primary-key-only schemas that were never written to. This plan finishes that scaffolding, screen by screen: **master data → transactional data → POS terminal screen**.

### Decisions locked in

- **Connectivity model**: auto-detected, not a manual toggle. `enable_offline_mode` gates whether the *capability* exists for a deployment; a separate live connectivity store decides online vs. offline moment-to-moment (browser `online`/`offline` events + a periodic heartbeat ping to the server, since a till can report "online" to the OS while the site itself is unreachable, and vice versa on some networks).
- **Conflict policy** (for Phase 2's queued writes): queue + manual review. A write that fails server-side validation on replay goes to a "needs review" queue visible on the Sync page — never silently dropped or auto-overwritten. Successful syncs happen automatically in the background.
- **Pacing**: each phase is implemented and verified end-to-end before moving to the next, across separate sessions rather than attempting all three at once.

---

## Phase 1 — Master Data Offline — ✅ Shipped (2026-08-08)

Doctypes: Item, Item Group, Customer, Price List, Pricing Rule, Sales Taxes and Charges Template, POS Profile, Mode of Payment — exactly the `OFFLINE_CAPABLE_DOCTYPES` already named in `engine/index.js` before this phase.

### What shipped

- **Backend** — `easy_pos/api/sync.py`: `get_offline_snapshot(pos_profile)`, one whitelisted call that reuses the *existing* resolution helpers (`easy_pos.api.item.get_items`, `easy_pos.api.item.get_item_groups`, `easy_pos.api.pos.get_taxes_and_charges_template`) instead of re-deriving stock/rate/tax math in JS — the cached item rows are exactly what the terminal would already see live, for the profile's own warehouse/price list. One deliberate simplification: resolution runs with no `customer`, so a cached item's rate is the generic (non-customer) price-list rate; a customer-specific price only ever applies once one is picked in the cart, which needs the server anyway.
- **`posapp/src/engine/db.js`**: Dexie schema, now at v3 (see the migration gotcha below for why it isn't v2).
- **`posapp/src/engine/connectivity.js`** (new): `useConnectivityStore` — `isOnline`, updated by `window.addEventListener('online'/'offline')` plus a ~30s heartbeat to Frappe's built-in `ping` endpoint (bypasses the engine layer entirely — a heartbeat must never itself be routed to the local DB).
- **`posapp/src/engine/sync.js`** (new): `runFullSync(posProfile)` — fetches the snapshot, bulk-writes every Dexie table in one transaction, stamps a `meta.lastSyncedAt` per domain. Also `getDomainCounts`/`getLastSyncedTimes` for the Sync page. Triggered (a) automatically, fire-and-forget, once per shift-open when online (`posSessionStore.loadProfileDetails`), and (b) manually via the Sync page's Fetch button.
- **`posapp/src/engine/localReads.js`** (new): a small adapter registry that pattern-matches each call's `url`/`params`/`data` (the exact shapes `api/Items.js`, `api/ItemGroup.js`, `api/Customer.js`, `api/POSProfile.js`, `api/PriceList.js`, `api/PricingRule.js`, `api/Tax.js` already send) and serves the equivalent result from Dexie. Only the read shapes actually exercised by the Terminal/shift-load hot path are covered — anything else has no adapter and throws loudly instead of silently returning nothing.
- **`posapp/src/engine/index.js`**: rewritten so offline routing is based on *live connectivity* (not just the settings flag) and *never applies to writes* — a small `WRITE_METHOD_MARKERS` list (`client.insert`, `client.save`, `client.delete`, `client.submit`, `client.cancel`, `pos.create_`, `pos.cancel_`) keeps every write going to the server, where it'll simply fail with a network error while offline until Phase 2's write queue lands.
- **`posapp/src/pages/SyncPage.jsx`**: replaced every hardcoded mock with real state — per-domain row counts and `lastSyncedAt` read from Dexie, a working Fetch button, and the connectivity pill wired to `useConnectivityStore`.

### Known limitations (by design, deferred to a later pass)

- **No barcode/serial/batch offline search** — `ITEM_FIELDS` (and thus the cached snapshot) only carries `item_code`/`item_name`, not barcode rows, so offline search only matches by exact item code or a fuzzy code/name substring. A future snapshot revision would need to fold in `Item Barcode` rows.
- **No item-group hierarchy offline** — the cached `item_groups` table doesn't carry `parent_item_group`, so filtering by a parent group only exact-matches that one group offline, instead of expanding to its descendants the way `get_items` does live.
- Calls with no adapter (`fetchItemVariants`, `fetchProductBundleContents`, `fetchCustomerGroups`/`fetchTerritories`, `fetchProfilesForCompany`, `fetchCompanyDefaults`, `fetchItemUoms`, `fetchItemsValidationData`, ...) simply fail offline — acceptable for Phase 1 since none of them are on the Terminal's core add-to-cart path.
- Customer cache is capped at 2000 rows (`MAX_CACHED_CUSTOMERS` in `easy_pos/api/sync.py`) — most-recently-modified first — not a shop's entire multi-year customer history.

### Gotchas hit while building this (worth knowing before touching this code again)

- **`EASYPOS Settings` is the doctype's real name** (all caps), despite the field label reading "EasyPOS Settings" — `frappe.db.set_single_value("EasyPOS Settings", ...)` silently no-ops against a doctype that doesn't exist by that exact casing.
- **Dexie cannot change an existing table's primary key in place.** The original `db.js` had `items`/`item_groups`/`taxes` keyed by `"name"` (an empty, never-written-to stub). Declaring a v2 that changes their key straight to `item_code`/`item_group`/`template` throws `"Not yet support for changing primary key"` on any browser that already has the v1 database open — which then **closes the whole database**, cascading into `DatabaseClosedError` on every subsequent call. Fixed by splitting the migration across two versions: v2 drops the three affected tables (`null` in `.stores()`), v3 recreates them with the new key. Any future primary-key change on an existing table needs the same drop-then-recreate two-step, never a direct key change in one version bump. Verified by reproducing the exact scenario — a raw IndexedDB built to the original shipped v1 schema with real data in an unaffected table — and confirming a normal page load migrates it cleanly with no manual intervention.
- **Custom whitelisted methods (`get_items`, `search_item`, `get_item_groups`, `get_taxes_and_charges_template`, ...) have no `doctype` param for `engine/index.js`'s old doctype-extraction logic to find** — only generic `frappe.client.*` calls do. The original stub's `isOfflineCapable(doctype)` approach would never have routed these hot-path calls locally at all. Fixed by dropping doctype-extraction entirely in favor of asking `localReads.js` directly ("does an adapter exist for this exact call shape?") — capability is now defined by what's actually implemented, not by a doctype allowlist that doesn't match how these endpoints are called.

### Verification performed

- Backend: `get_offline_snapshot` exercised directly via a throwaway `bench execute` script (deleted after) against `easy_pos_site.local`, confirmed correct counts for every domain.
- Frontend: confirmed auto-sync on shift-open populates Dexie with matching counts (visible on the Sync page); confirmed that forcing the connectivity store offline makes an item/customer search resolve from cache with **zero** network calls; confirmed the Dexie migration fix against a reproduction of the exact pre-existing-v1-database failure scenario.

---

## Phase 2 — Transactional Data Offline (planned, not started)

Writes in scope: `create_invoice` (draft + submit), `create_opening_entry`, `create_closing_entry`, `createCustomer`/`createAddress`/`createContact`.

Plan: add a Dexie `pending_mutations` table (`method`, `payload`, `createdAt`, `status: queued|synced|failed`). When offline, `engineCall`'s write branch enqueues instead of failing, and optimistically returns a locally-generated placeholder result (e.g. a temp invoice name) so the UI flow (draft save, checkout, receipt) doesn't need offline-specific branching in components. A background replay loop (triggered on the `online` event + periodic) drains the queue in order; anything the server rejects on replay moves to `status: 'failed'` with the server's error message attached, surfaced on the Sync page's "needs review" list for manual resolution — per the conflict policy above. Held/parked sales need special care since `DraftPickerModal` currently fetches Drafts live from the server — offline it must also list locally-queued/not-yet-synced drafts.

## Phase 3 — POS Terminal Screen (planned, not started)

Wire the connectivity state into the actual terminal UX: a persistent online/offline indicator in `Topbar`, disable/relabel actions that need the server (payment gateway checkout, receipt notifications — these stay online-only, queue the invoice but skip gateway/notification steps offline with a clear message), make `Items`/`Cart`'s currently-silent `catch`-and-swallow fetch failures surface a visible "using cached data" state instead of quietly failing when actually offline, and extend `LoadOpeningEntry`/`posSessionStore` to boot the terminal from cached session data if the shift-open check itself can't reach the server (e.g. app opened already offline). Loyalty summary and cart pricing (`get_cart_pricing`) need an offline-safe fallback too — likely a simplified local tax/discount calc reusing `utils/tax.js`, since the full pricing engine is server-side only.

## Files touched (Phase 1)

- New: `easy_pos/api/sync.py`, `posapp/src/api/Sync.js`, `posapp/src/engine/connectivity.js`, `posapp/src/engine/sync.js`, `posapp/src/engine/localReads.js`
- Edited: `posapp/src/engine/db.js`, `posapp/src/engine/index.js`, `posapp/src/pages/SyncPage.jsx`, `posapp/src/store/posSessionStore.js`

## Next step

Pick up Phase 2 (the offline write queue) in a dedicated session, following the plan above — it's the one that turns "read-only offline browsing" into an actually usable offline till, since a cashier can browse the cached catalog today but still can't check out without a connection.
