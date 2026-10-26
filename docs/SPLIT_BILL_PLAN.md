# Split Bill — Implementation Plan

Status: **implemented** (2026-10-24) on branch `split-bill` (based on `develop` @ `79b0ba9`), using the recommended answer for D1–D3. Roadmap item #4 in `UPCOMING_FEATURES.md`.

**Where the build differs from the plan below:**
- **Coupon counting needed no backend flag.** `coupon_code` is only used by `_finalize_invoice` to count the redemption, so the frontend just sends it with the first submitted bill and leaves it off the rest (`split.couponUsed`).
- **Free items are assigned by hand** (bill chips, defaulting to Bill 1). The pricing response doesn't say which line triggered a free item, so there's no reliable way to place it automatically.
- **Flat "Actual" charges** are pro-rated across bills (`utils/splitBill.js`). This needed a fix to an existing bug: `computeTaxes` (`utils/tax.js`) used to read an Actual row's `tax_amount` from a copy it had already reset to 0, so every Actual charge was dropped from the cart total and from the taxes sent to ERPNext.
- **Draft takeover:** a by-item bill only takes over the cart's saved Draft if it's for the same customer, because `_save_sales_invoice`'s update path keeps the Draft's original customer. If no bill matches, the modal warns that the Draft will stay in Load Draft.

Scope: three ways to split one cart at payment time — **by item**, **evenly**, and **by person / custom amount**.

## 1. The core decision: two different mechanisms

The three modes don't all fit "N separate invoices":

| Mode | What gets split | Result in ERPNext |
|---|---|---|
| **By item** | Cart lines (and qty within a line) | **N Sales Invoices**, one per bill, each with its own items, taxes, payments, and optionally its own customer |
| **Evenly** | The grand total, into N equal shares | **One Sales Invoice**, paid in N payer turns |
| **By person / custom amount** | The grand total, into amounts each payer chooses | **One Sales Invoice**, paid in N payer turns |

Why evenly and custom amount don't produce N invoices: splitting a ₹900 cart of three items three ways would need each invoice to carry ⅓ of every line. That breaks on whole-number UOMs (`must_be_whole_number`), on serial-tracked rows (always one unit), on batch rows, and on Product Bundles (`make_packing_list` would explode fractional components). It also leaves stock and item-wise sales reports full of fractional quantities. An even split is really a *payment* split, and ERPNext already models that: one invoice with several `payments` rows.

**Decision for you (D1):** do you agree evenly and custom amount stay one invoice? The alternative, N invoices with fractional qty, only works for shops that sell nothing but fractional-UOM, non-serial, non-bundle items. I don't recommend it.

## 2. User flow

1. Cart gets a **Split Bill** button next to Pay (disabled for an empty cart or fewer than 2 units).
2. It opens `SplitBillModal` with three tabs: **By Item**, **Evenly**, **Custom Amount**.
3. Starting a split **freezes the cart**: lines and prices are snapshotted, and the cart's editing controls (qty, remove, discount, coupon, customer) are disabled until the split finishes or is cancelled. A banner reads "Split in progress — 1 of 3 paid".
4. Each bill (by item) or payer turn (evenly/custom) is paid through the existing `InvoicePay` modal. Afterwards the split modal comes back showing progress.
5. When the last bill or turn is paid, the cart resets as it does after a normal checkout.

### By item
- Starts with 2 bills; the cashier can add or remove bills (minimum 2).
- Every cart line has a bill picker (chips "1 · 2 · 3"). New lines default to Bill 1.
- A plain or batch line with qty > 1 can be **split across bills** with a per-bill qty stepper (whole numbers only; the parts must add up to the line qty). Serial rows (always qty 1) and Product Bundle parents move as whole lines.
- **Free items** from Product Discount pricing rules go to the bill of the line that triggered them. If that's ambiguous (the trigger line is split across bills), they go to the bill holding most of its qty.
- Each bill shows its own subtotal, tax, and total, computed by calling the existing `computeCartTotals` (`utils/tax.js`) on that bill's lines. No new tax logic.
- Each bill has an optional **customer** override (`LinkField`, defaulting to the cart's customer), so bills can go to different people with their own loyalty points and receipt notifications. This is the "by person" case for items.
- **Pay Bill N** opens `InvoicePay` for that bill only. A bill can't be paid while any line is unassigned.

### Evenly
- The cashier picks N (2–20). Each share is `grandTotal / N`, rounded to currency precision, and the last share takes the rounding remainder so the shares add up exactly.
- Turns are paid in order, each through `InvoicePay` in a new **payer-turn mode**: amount due = this share; the payment-mode rows work as they do today; the change shown is for this payer only.

### Custom amount
- The same as evenly, except each turn's amount is typed in before paying (capped at the remaining balance). The last turn's amount is fixed to whatever is left.

## 3. Frontend design

### State: a `split` slice in `cartStore`
```js
split: null | {
  mode: "item" | "even" | "custom",
  frozen: { items, freeItems, discountOn, discountPercentage, couponCode, taxes, grandTotal },
  // by item
  bills: [{ id, customer, customerName, lines: [{ srcIndex, qty }], freeLines: [...],
            status: "open" | "paid", invoiceName }],
  // evenly / custom
  turns: [{ amount, payments: [{ mode_of_payment, amount }], status }],
  draftName: "",   // evenly/custom: the single Draft invoice being paid down
}
```
Actions: `startSplit(mode)`, `assignLine`, `setLineQtyForBill`, `addBill`, `removeBill`, `setBillCustomer`, `markBillPaid`, `recordTurn`, `cancelSplit`.

**Why freeze:** Cart's pricing effect (`fetchCartPricing` / `computeCartPricingLocally`) re-runs whenever `items` changes. If paid bills were removed from `items` one at a time, quantity-based pricing rules could stop matching the remaining items, and Bill 2's total would change after the customer was told the price. Paying from a frozen snapshot keeps every quoted total fixed. `items` is only cleared when the whole split completes.

**Cancelling midway:** in by-item mode, already-paid bills stay submitted. The unpaid bills' lines are written back as the cart's `items`, pricing re-runs on them, and a notice says so. In evenly/custom mode, the payments taken so far are already on the Draft invoice (§4), so cancelling just leaves that Draft with its partial payments, retrievable through `DraftPickerModal` like any held sale.

### `InvoicePay` refactor (the main change)
Today `InvoicePay` reads the cart directly from `cartStore` and always calls `resetCart()` when it finishes. It gains an optional `bill` prop:

```js
<InvoicePay bill={{ items, freeItems, customer, taxes, grandTotal, discountOn,
                    discountPercentage, salesInvoiceName, amountDue, priorPayments,
                    finalTurn }} ... />
```
- When `bill` is absent, behaviour is exactly as today (no regression for normal checkout).
- When `bill` is present: `buildCleanItems` and `buildInvoicePayload` read from `bill`; payments live in local `useState` instead of `cartStore.payments`; `finishCheckout` calls `onComplete` but **not** `resetCart()`, because the split controller decides when the cart resets.
- **Payer-turn mode** (evenly/custom): `amountDue` replaces `grandTotal` for balance and change. The amount recorded per mode is the *net* amount (tendered minus change), so the invoice's payment rows always add up exactly to its grand total.

### New components
- `components/Cart/SplitBillModal.jsx`: the three tabs, uses `Modal`, `FilterChips` (tabs), `NumberField`, `LinkField`, `SaveButton`, `ErrorAlert`.
- `components/Cart/SplitBillLines.jsx`: the by-item assignment grid (CSS grid, reusing the `.pos-table-*` classes; not a `ChildTable`, because it needs inline controls per row).
- The split-in-progress banner in `Cart/index.jsx`.

## 4. Backend design

### By item: N calls to the existing `create_invoice`
Each bill is paid through the normal `postPaymentInvoice` → `create_invoice(submit=1)` path. Bills are created **lazily, one per payment**, not all up front:
- No new endpoint, and the **offline outbox keeps working unchanged**: `engine/index.js` already diverts `create_invoice` to `queueOfflineInvoice` while offline, so each offline bill becomes its own queued invoice.
- An abandoned split never leaves orphan Drafts behind. The unpaid lines go back to the cart instead.

New custom fields on Sales Invoice (patch `easy_pos/patches/add_sales_invoice_split_fields.py`, Query Builder, following existing patches):
- `ep_split_group` (Data, read-only): a client-generated UUID shared by every invoice from one split.
- `ep_split_index` (Data, read-only): for example `"2/3"`.

`_save_sales_invoice` copies both from the payload on insert only. They power a "Split 2/3" badge on the Invoices list and invoice detail page, plus a "Related split invoices" link block on `InvoiceDetailPage`.

If the cart was a **resumed Draft** (`salesInvoiceName` or `pendingOfflineId` set), **Bill 1 takes over that Draft** (same `sales_invoice` / `updateQueuedInvoice` path `InvoicePay` uses today), and later bills are new invoices. Otherwise the old Draft would linger, still holding the full cart.

### Evenly / custom: one Draft invoice paid down in turns
- At the first turn, the cart is saved as a Draft (`create_invoice(submit=0)`, the same as Save Draft) and the name is kept in `split.draftName`.
- Each non-final turn saves the Draft again with the payments added up so far (`submit=0`). If the tab closes after payer 1 has paid cash, that payment is on record in a retrievable Draft rather than lost.
- The final turn submits (`submit=1`) with the full payments.
- Two payers paying by the same mode (both cash) merge into one `payments` row, which is what ERPNext expects. The per-payer breakdown goes into the invoice's `remarks` (e.g. "Split 3 ways: Cash 300, Card 300, Cash 300"). No new child table.

### Coupons and order-level discount
- **Order-level discount %**: each by-item bill gets the same `additional_discount_percentage`, which is exact for a percentage.
- **Coupon code**: `_finalize_invoice` calls `update_coupon_code_count(..., "used")` once per submitted invoice, so a 3-bill split would use up 3 redemptions. Add a `count_coupon` flag to `create_invoice` / `_finalize_invoice` (default `True`); the frontend sends `True` only for the first bill it submits. Evenly/custom is one invoice, so it's unaffected.

### Taxes: flat "Actual" charges
`computeTaxes` copies an `Actual` row's `tax_amount` as-is, so a ₹50 delivery charge would appear on **every** bill. For by-item, the split controller **pro-rates `Actual` (and `On Item Quantity`) rows by each bill's net total**, with the rounding remainder on the last bill, before sending `taxes`. Percentage rows need nothing extra, because `computeCartTotals` recomputes them per bill.

**Decision for you (D2):** pro-rate flat charges across bills (recommended), or put each whole charge on Bill 1?

## 5. Payment gateways (Razorpay)

- **By item:** works unchanged. Each bill is a full invoice going through the existing `payWithGateway` → `create_payment_gateway_order` → `verify_payment_gateway_order` flow. The receipt tab is opened synchronously inside each "Pay Bill N" click, as the CLAUDE.md popup gotcha requires.
- **Evenly / custom:** `verify_payment_gateway_order` **submits the invoice** as soon as one charge verifies, and the invoice has only one `ep_payment_gateway_reference` field. A non-final gateway turn would therefore submit an under-paid invoice and overwrite the earlier reference. **Phase 1: allow a gateway only on the final turn** (the gateway row is disabled on earlier turns with a tooltip explaining why). Phase 2, if needed: add a `finalize` flag to verify plus a per-payment reference (on the `Sales Invoice Payment` row) so gateway charges can be partial.

**Decision for you (D3):** is the Phase 1 limit acceptable?

## 6. Customer display

- Starting a split and each turn sends `PAYMENT_STATUS` with `{ status: "processing", grandTotal: <this bill/share>, splitLabel: "Bill 2 of 3" }`. `PaymentView` shows the label under "Please Pay".
- A **new message, `SPLIT_PART_COMPLETE`**, is sent after each non-final bill or turn ("Bill 2 paid, thank you"). It is *not* `INVOICE_COMPLETE`, whose thank-you screen times out to idle even though the sale isn't finished. Only the final bill/turn sends `INVOICE_COMPLETE`. Per the CLAUDE.md gotcha, `CustomerDisplayPage` also ignores `CART_UPDATE`/`CART_IDLE` while showing a part-complete screen.

## 7. Receipts and notifications

- **By item:** each bill prints its own receipt (the existing `finishCheckout` print path) and sends its own Email/SMS notification to that bill's customer. Nothing new needed.
- **Evenly / custom:** one receipt, printed at the final turn. Each earlier payer gets an optional **payment slip** (client-rendered, like `buildOfflineReceiptHtml`: amount, mode, "Payer 1 of 3", invoice name). It's controlled by a checkbox in the turn screen so cashiers can skip it.

## 8. Edge cases covered

| Case | Handling |
|---|---|
| Loyalty redemption | By item: per bill, against that bill's customer (the `loyaltyPointsBalance` fetch moves into the bill when its customer differs). Evenly/custom: only on the final turn, against the single invoice. |
| Serial / batch rows | Serial rows move whole; batch rows can be qty-split but each part keeps the same `batch_no`. |
| Product Bundles | Move whole; ERPNext explodes `packed_items` per invoice as usual. |
| Rounding | Each by-item invoice rounds itself, so bill totals can add up to a few paise more or less than the unsplit cart. The modal shows the per-bill totals that will actually be charged. |
| Shift close | `get_closing_entry` adds up payments per `custom_ep_opening_entry`, so N invoices or N turns are counted correctly with no change. |
| Reports | By item increases the transaction count (and lowers "Avg ticket"). That's correct, since they are separate sales, and is noted in the PR. |
| Credit notes | Per invoice, unchanged. A return against Bill 2 doesn't touch Bills 1 and 3. |
| Offline | By item: each bill is queued separately (works today). Evenly/custom: the Draft saves between turns go through the same queue (`updateQueuedInvoice` once the first save has queued). Gateway is already disabled offline. |

## 9. Work breakdown and verification

1. **Backend:** split custom-fields patch; `_save_sales_invoice` copies `ep_split_group`/`ep_split_index`/`remarks`; `count_coupon` flag. Verify with `bench execute` on a temp script: two invoices sharing a group, coupon count incremented once.
2. **`InvoicePay` `bill` prop refactor**, with a regression check that normal checkout, Save Draft, gateway checkout, and offline checkout behave as before.
3. **`cartStore` `split` slice** and the cart freeze/banner.
4. **`SplitBillModal`**, by-item tab first (the most complex), then evenly, then custom.
5. **Customer display** messages.
6. **Invoices list/detail** split badge and related-invoices block.
7. Lint (`npx eslint`) after every step; `CLAUDE.md` gotcha entry plus marking `UPCOMING_FEATURES.md` #4 done at the end.

Manual test matrix, run in the browser: 3-way by-item split with one qty-split line, a serial item, a bundle, and a free item; a different customer on one bill; a coupon (count +1 only); a flat charge (pro-rated); evenly 3 ways with cash change on turn 1; custom amount with Razorpay test card on the final turn; cancelling at bill 2 of 3; and one by-item split done offline then synced.

**i18n note:** this branch is based on `develop`, which doesn't have the multi-lingual work yet. If `multi-lingual-support` merges first, every new string goes through `t()`/`_t()` and RTL-safe logical CSS; otherwise those strings get translated once both are on `develop`.
