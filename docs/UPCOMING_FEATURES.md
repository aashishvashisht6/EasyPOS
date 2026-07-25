# POS Terminal — Upcoming Features

Status: **approved for future implementation** (2026-07-25) — not yet built. This is a planning document only; each item below still needs its own implementation plan before work starts. Selected from a broader feature-gap analysis against common POS products, cross-checked against what Easy POS already ships (see [README's Features](../README.md#features) and [Roadmap](../README.md#roadmap) sections) so nothing here duplicates existing functionality.

## 1. Barcode Scanner Hardware Input

Accept input from USB/Bluetooth barcode scanners (and optionally a device camera) directly into the Terminal's item search, so a cashier can scan an item's barcode to add it to the cart instead of typing/searching. Most hardware scanners act as a keyboard-wedge device (rapid keystrokes + Enter), so this is largely a matter of listening for fast sequential input on the existing search box in `posapp/src/pages/POSTerminalPage.jsx` and resolving it against `Item` barcodes via `easy_pos/api/item.py`. Already flagged in the README roadmap as a planned hardware capability.

## 2. Receipt Delivery

Beyond the existing `print_receipt_on_order_complete` POS Profile flag, let a cashier email or SMS/WhatsApp the receipt to the customer at checkout completion — a lightweight follow-up to `InvoicePay`'s "Complete Payment" step. Needs a backend endpoint that renders/sends the invoice (likely reusing the configured `print_format` and a messaging channel — email is the simplest first cut via Frappe's own email queue; SMS/WhatsApp would need a gateway integration).

## 3. Customer-Facing Second-Screen Display

A secondary, read-only view (e.g. a second browser tab/window driven by the same cart state) that shows the customer their running cart items and total during checkout — common on dual-screen POS hardware. Needs a way to broadcast `cartStore` state to a second window (e.g. `BroadcastChannel`/`localStorage` events) and a new minimal route/page for the customer-facing view.

## 4. Split Bill

Let a single cart be divided into multiple separate invoices — split evenly, by item, or by person — at payment time, rather than one invoice per cart. Touches `Cart/index.jsx` and `InvoicePay/index.jsx`; likely needs a "split" step before `create_invoice` that partitions cart items/amounts across N sub-invoices.

## 5. Manager-Approval PIN for Discount / Price Override / Line Void

Require a second-factor PIN (from a manager/supervisor role) before allowing an item-level discount, a manual rate override, or removing a line — the POS Profile flags `allow_rate_change`/`allow_discount_change` already gate *whether* these are allowed at all; this adds an approval step *when* they're used. Needs a lightweight PIN-prompt modal and a backend check against a manager-role user, plus an audit trail (see #10 for reporting tie-in).

## 6. Customer Purchase History (Invoice Register, Pre-Filtered by Customer)

From a customer's detail page (`CustomerDetailPage.jsx`) or the Cart's selected customer, navigate straight into the existing `InvoiceRegisterPage` pre-filtered to that customer's invoices, instead of building a separate history view. Mostly wiring: pass a `customer` query param/filter into the Invoice Register's existing filter state.

## 7. Post-Sale Feedback

Optionally prompt the customer (or send a follow-up link) to rate their experience after a completed sale, tied back to the Sales Invoice. Needs a new lightweight doctype or reuse of a Frappe feedback mechanism, plus a trigger point in `InvoicePay`'s completion flow or a follow-up notification/link.

## 8. Item Variants Selection UI

When adding an item with variants (ERPNext's Item Attribute / template-variant model — e.g. size/color) to the cart, show an attribute-picker instead of requiring the cashier to know the exact variant `item_code`. Touches the item grid/search in `POSTerminalPage.jsx` and `easy_pos/api/item.py`'s item resolution.

## 9. Bundle / Kit Items

Support selling a composite "kit" item that, on submit, decrements stock for its component items (ERPNext's Product Bundle doctype) rather than the kit itself. Needs cart/backend awareness that a line is a bundle so `create_invoice` in `easy_pos/api/pos.py` submits the right stock-affecting rows, mirroring how ERPNext's own Sales Invoice already expands Product Bundles.

## 10. Reports & Dashboard for Cashier

A per-cashier / per-shift dashboard — sales totals, item mix, hourly trend, and (once shipped) X/Z shift report data — surfaced under the currently-stubbed "Reports" sidebar item. Read-only aggregation views over existing Sales Invoice / EP Opening Entry / EP Closing Entry data; no new transactional doctypes expected, mostly new report queries + a dashboard page.

## 11. Real Payment Integration

Replace the current manual "type the amount received" payment-mode entry in `InvoicePay/index.jsx` with a live payment gateway/terminal integration (card swipe, UPI/QR, or similar) that confirms the actual amount charged before the invoice submits. Scope depends heavily on which payment provider(s) are targeted — needs a provider decision before implementation planning.

## 12. Offline & Sync

The big one, already named in the README roadmap: RxDB/IndexedDB-backed local storage, offline PIN login, an offline invoice mutation queue, and a background sync engine to replace the current UI-only `SyncPage.jsx` mock. This is a foundational architecture shift (today's build is online-only per `CLAUDE.md`), not an incremental feature — it should get its own dedicated design pass before scoping, likely broken into sub-milestones (local storage layer → offline queue → sync engine → conflict UI).

## 13. PWA (Installable Progressive Web App) — ✅ Done (2026-07-25)

~~Currently `posapp/` has no PWA setup at all — no `manifest.json`, no service worker, no `vite-plugin-pwa` (checked: only `favicon.svg` exists under `public/`).~~ Shipped: an installable manifest (`posapp/public/manifest.webmanifest`), a Workbox-generated service worker precaching the app shell/static assets (JS/CSS/icons — never `/api/` responses, since auth is cookie-based), and a prompt-to-reload update banner (`posapp/src/pwa/PwaUpdateBanner.jsx`). The service worker is served through a whitelisted API endpoint (`easy_pos/api/pwa.py`) rather than a static file, to get correct `/posapp/*` scope despite the built assets living under `/assets/easy_pos/posapp/*` — see the "PWA installability" entry in [`CLAUDE.md`](../CLAUDE.md) for the full architecture. Scoped to installability + static-asset caching only, per the original plan — no offline transactional data caching (that remains #12).

This was a natural prerequisite for #12: a service worker that caches the app shell/assets is what actually makes offline-first (#12) work in a browser at all, so PWA shell setup (manifest + service worker + Vite PWA plugin) needed to land before offline data sync. That sequencing is now complete — #12 is unblocked to start on its own next.

## Next step

Each remaining item above needs its own implementation plan (design, affected files, backend/frontend split, verification) before coding starts. Given the range in size — #6 is a small wiring change, #12 is a multi-milestone architecture project — these should be scoped and picked up independently rather than as one batch. With #13 shipped, #12 (Offline & Sync) is the next logical candidate to scope.
