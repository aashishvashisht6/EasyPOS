# POS Terminal — Pricing Rule / Item Price / Price List / POS Profile Use Cases

Status: **implemented and verified** (2026-07-25) — every use case below is marked ✅ Done, ⚠️ Partial/gap, or ⛔ Deferred. Verified live against `easy_pos_site.local`: backend calls exercised directly (`get_cart_pricing`, `get_items`, `ignore_pricing_rule`, `item_groups` restriction) and the Terminal UI end-to-end (adding a discounted item, order-discount gating, coupon input, draft-invoice save with `price_list_rate`/`discount_percentage`/`pricing_rules` persisted correctly on the Sales Invoice Item).

## Current state (as of 2026-07-25)

- **Item Price**: resolved server-side in `easy_pos/api/item.py` (`_get_rate_map`, `_get_item`). Matches `Item Price` rows on `item_code`, `price_list = <POS Profile.selling_price_list>`, `selling = 1`, now with customer-specific rows preferred over generic ones, `valid_from`/`valid_upto` filtering, and an Item `standard_rate` fallback when no row matches.
- **Pricing Rule** ("Discount" in this app's UI): still has its full CRUD editor (`posapp/src/api/PricingRule.js` + `posapp/src/pages/DiscountDetailPage.jsx`), and is now also **evaluated live in the Terminal** via a new `easy_pos/api/pricing.py::get_cart_pricing`, which delegates per cart line to ERPNext's own `erpnext.stock.get_item_details.get_item_details` (the same call desk's Sales Invoice form makes) instead of re-implementing rule matching/stacking. The Cart calls this on every item/qty/customer/coupon change and merges the result — rate, `discount_amount`, `discount_percentage`, `pricing_rules`, and free items — onto each line.
- **POS Profile**: `posSessionStore.loadProfileDetails` now also lifts `ignore_pricing_rule`, `allow_rate_change`, `allow_discount_change`, `item_groups`, `customer_groups` into session state, and the Terminal reads all five (see section D).

## Decisions made (and honored in the implementation)

- Pricing Rules **auto-apply** on add-to-cart/checkout via ERPNext's own pricing engine, not manual-only. `allow_rate_change`/`allow_discount_change` gate whether the cashier can override the result.
- POS Profile scope for this pass is **pricing-related fields only**: `ignore_pricing_rule`, `allow_rate_change`, `allow_discount_change`, `item_groups`, `customer_groups`. (`hide_images`, `hide_unavailable_items`, `auto_add_item_to_cart`, `validate_stock_on_save`, `disable_rounded_total`, `allow_partial_payment` remain out of scope.)
- Item Price resolution was extended to **full resolution rules**: customer-specific override + `standard_rate` fallback + date-validity filtering.

## A. Item Price Resolution

`_get_rate_map` / `_get_item` in `easy_pos/api/item.py`.

| ID | Status | Use case |
|---|---|---|
| IP-01 | ✅ Done | Item has a matching Item Price row for the POS Profile's `selling_price_list` → that rate is used. |
| IP-02 | ✅ Done | Item has an Item Price row scoped to the current cart's `customer` for the same price list → customer-specific price wins over the generic price-list row. `_get_rate_map` now takes `customer` and prefers a matching customer row. |
| IP-03 | ✅ Done | No Item Price row matches at all (price list or customer) → falls back to the Item master's `standard_rate` instead of `0`. Applied in both the grid (`_get_rate_map`) and the cart pricing engine (`pricing.py`'s own fallback, since ERPNext's `get_item_details` doesn't do this on its own). |
| IP-04 | ⚠️ Partial | No Item Price row *and* no `standard_rate` on the Item → rate resolves to `0`. The resolution itself is correct; a dedicated "no price set" UI flag (vs. just showing ₹0) was not added — still reads as a plain zero rate in the grid/cart. |
| IP-05 | ✅ Done | Multiple Item Price rows match the same item/price-list/customer combo with different `valid_from`/`valid_upto` ranges → only the row whose validity window includes today is used (`_get_rate_map`'s `_is_valid` check). |
| IP-06 | ✅ Done | Item Price row exists but is expired (`valid_upto` < today) → excluded from matching. |
| IP-07 | ⛔ Deferred | Item Price defined in a different UOM than the cart line's UOM. Not addressed — the app only ever transacts in stock UOM, no per-line UOM switch exists in the Terminal. |
| IP-08 | ⛔ Deferred | Selling Price List's currency differs from the POS Profile's `currency`. No explicit check added — still assumes they match, same as before. |

## B. Price List Sourcing (POS Profile → Session → Item lookup)

| ID | Status | Use case |
|---|---|---|
| PL-01 | ✅ Done | POS Profile has `selling_price_list` set → Terminal uses it for all Item Price lookups. |
| PL-02 | ⛔ Deferred | POS Profile has `selling_price_list` blank → no fallback added (Selling Settings default price list, or blocking session open); still resolves to rate 0 per IP-04. |
| PL-03 | ✅ Done (by construction) | Cart's customer has their own `default_price_list` on the Customer doctype, differing from the POS Profile's → POS Profile always wins, since `pricing.py`/`_get_rate_map` only ever pass the profile's `selling_price_list`, never reading the customer's own default. |

## C. Pricing Rule Auto-Application

Implemented via `easy_pos/api/pricing.py::get_cart_pricing`, which calls ERPNext's own `erpnext.stock.get_item_details.get_item_details` per cart line — so matching, discount application, and priority/stacking (PR-01–19, PR-21–23) all inherit ERPNext's exact desk-POS semantics rather than a reimplementation. Verified live: a 10%-off Item Code rule (`PRLE-0001`) applied correctly end-to-end from add-to-cart through to the saved Sales Invoice Item's `discount_percentage`/`discount_amount`/`pricing_rules`.

### Matching (when is a rule eligible)

| ID | Status | Use case |
|---|---|---|
| PR-01 | ✅ Done | Rule's `apply_on = Item Code` and cart item matches one of the rule's listed items → eligible. Verified live. |
| PR-02 | ✅ Done | Rule's `apply_on = Item Group` and cart item's item group (or a parent group) matches → eligible (handled inside ERPNext's `get_pricing_rule_for_item`). |
| PR-03 | ✅ Done | Rule's `apply_on = Brand` and cart item's brand matches → eligible (same engine). |
| PR-04 | ✅ Done | Rule scoped to a specific `customer` and the cart's selected customer matches → eligible; cart's `customer` is passed into `get_cart_pricing`'s `args.customer`, `None` when walk-in. |
| PR-05 | ✅ Done | Rule scoped to a `customer_group` → eligible (ERPNext resolves `customer_group`/`territory` from `args.customer` internally). |
| PR-06 | ✅ Done | Rule has `min_qty`/`max_qty` thresholds → the Cart re-fetches pricing on every qty change (`cartKey` includes `qty`), so thresholds are re-evaluated live. |
| PR-07 | ✅ Done | Rule has `min_amt`/`max_amt` thresholds on the item line → same live re-evaluation; a whole-transaction `min_amt` (`apply_on = Transaction`) is out of scope, see PR-20. |
| PR-08 | ✅ Done | Rule has `valid_from`/`valid_upto` → eligible only within that date window (ERPNext engine, `transaction_date` passed as today). |
| PR-09 | ✅ Done | Rule's `selling` checkbox is unchecked → never eligible (ERPNext engine only evaluates selling-side rules for a Sales Invoice doctype). |
| PR-10 | ✅ Done | Rule's `disable` is checked → never eligible. |
| PR-11 | ✅ Done | Rule is `coupon_code_based` → Cart has a coupon-code input; `get_cart_pricing` resolves the typed code to a Coupon Code doc name and validates it (`validate_coupon_code`) before pricing, surfacing an error in the UI if invalid/expired/exhausted. Usage count increments on invoice submit (`update_coupon_code_count`). |

### Applying (once eligible)

| ID | Status | Use case |
|---|---|---|
| PR-12 | ✅ Done | `rate_or_discount = Discount Percentage` → effective rate/`discount_amount` reduced by that %. Verified live (10% rule → ₹400 → ₹360). |
| PR-13 | ✅ Done | `rate_or_discount = Discount Amount` → flat amount deducted per unit (same `_effective_rate` formula, matches ERPNext's `calculate_item_values`). |
| PR-14 | ✅ Done | `rate_or_discount = Rate` → ERPNext's `apply_price_discount_rule` overrides `price_list_rate` directly for this case; passed through unchanged. |
| PR-15 | ✅ Done | `price_or_product_discount = Product Discount` (free item) → `free_item_data` from the engine is surfaced as `cartStore.freeItems`, shown as a distinct read-only "Free Items" section in the Cart, and included in the invoice payload with `is_free_item: 1`. `is_recursive` free-item rules are a known gap (see below) since they need a full invoice `doc` context the per-item preview call doesn't have. |
| PR-16 | ⛔ Deferred | Rule sets `margin_type`/`margin_rate_or_amount` → not surfaced in the Cart UI (rare in POS); the engine still computes it internally but the value is dropped. |

### Priority / stacking (multiple eligible rules for the same item or order)

| ID | Status | Use case |
|---|---|---|
| PR-17 | ✅ Done | Exactly one rule matches an item → applied, verified live. |
| PR-18 | ✅ Done | Two+ item-level rules match, `apply_multiple_pricing_rules` **unchecked** → only the highest-priority rule applies (ERPNext engine behavior, inherited as-is). |
| PR-19 | ✅ Done (via ERPNext) | Two+ rules match, `apply_multiple_pricing_rules` **checked** → all apply, compounding per ERPNext's own `apply_price_discount_rule` logic — not re-derived independently, so it's exactly desk's behavior rather than a guessed formula. |
| PR-20 | ⛔ Deferred (documented gap) | An item-level rule and a `Transaction`-level rule (e.g. "10% off orders over ₹5000") both eligible → **not supported**. `get_cart_pricing` prices one line at a time with no visibility into the whole cart's running total, so a `Transaction`-scoped Pricing Rule won't be evaluated correctly. Flagged in `pricing.py`'s docstring. |
| PR-21 | ✅ Done | Pricing Rule discount vs. manual order-level discount % → manual entry is disabled outright when `allow_discount_change = 0` (PP-03); when allowed, both apply (item-level from the engine, order-level from the cashier), matching how ERPNext layers additional discount on top of item-level pricing. |
| PR-22 | ✅ Done | Cart qty/amount changes crossing back out of a threshold → re-fetched live (same mechanism as PR-06/07); free items and discounts drop on the next fetch. |
| PR-23 | ✅ Done | Item removed from cart / cart cleared → `freeItems` cleared explicitly (`clearItems`, and a guard in the pricing effect for removing the last item one-by-one). |

## D. POS Profile Pricing Validations

| ID | Status | Use case |
|---|---|---|
| PP-01 | ✅ Done | `ignore_pricing_rule = 1` → skips all Pricing Rule matching/application (Item Price lookup still runs). Verified live via direct backend call: rate stayed at price-list rate with `has_pricing_rule: false`. |
| PP-02 | ✅ Done | `allow_rate_change = 0` → cart line's rate renders read-only; `= 1` → renders as an editable `CurrencyField` that also recomputes `amount`. Verified live (POS1 has `allow_rate_change = 0`, rate showed read-only). |
| PP-03 | ✅ Done | `allow_discount_change = 0` → order-level discount `SelectField`/`NumberField` disabled with an explanatory note; `= 1` → editable. Verified live (POS1 has `allow_discount_change = 0`). |
| PP-04 | ✅ Done | `item_groups` restricted → `get_items`/`search_item` filter to those groups (expanded to descendants), and the category tab bar (`ItemGroup`) hides non-allowed tabs, falling back to "All" if the current selection becomes invalid. Verified live via direct backend call (3-item "Consumable"-only result). |
| PP-05 | ✅ Done | `customer_groups` restricted → Cart's Customer `LinkField` passes `filters={ customer_group: ["in", groups] }` through to `frappe.desk.search.search_link`, no backend change needed. |
| PP-06 | ✅ Done | Empty `item_groups`/`customer_groups` → both restrictions treat an empty child table as "no restriction" (`_allowed_item_groups` returns `None`; `customerFilters` is `undefined`). |

## Known gaps (documented, not silently mishandled)

- **PR-20** — `Transaction`-level Pricing Rules (whole-order amount thresholds) aren't evaluated correctly; `get_cart_pricing` prices one line at a time with no visibility into the cart's running total. Documented in `pricing.py`'s docstring.
- **PR-15 (partial)** — `is_recursive` Product Discount rules need a full invoice `doc` object (ERPNext's `get_product_discount_rule` reads `doc.items`); the per-item preview call passes `doc=None`, so a recursive free-item rule would raise inside the engine — caught by `get_cart_pricing`'s per-item `try/except` and surfaced as a non-fatal per-line pricing error rather than crashing the cart.
- **PR-16** — margin-type rules aren't surfaced in the UI.
- **IP-04** — no dedicated "no price set" UI treatment beyond showing ₹0.
- **PL-02** — no fallback price list when the POS Profile's `selling_price_list` is blank.
- **IP-07 / IP-08** — UOM- and currency-mismatch edge cases not handled.
