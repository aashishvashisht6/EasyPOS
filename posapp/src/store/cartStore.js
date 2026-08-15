import { create } from "zustand";
import { flt } from "../utils/number";

const initialState = {
	customer: "",
	customerName: "",
	items: [],
	payments: [],
	salesInvoiceName: "",
	// Set when the loaded cart is a not-yet-synced offline draft (see
	// engine/outbox.js's pending_invoices) — this is the row's offline_id, NOT
	// its cashier-facing display_id (salesInvoiceName). When set, the next
	// Save Draft/checkout must update that same queued row in place
	// (engine/outbox.js's updateQueuedInvoice) instead of queuing a brand new
	// one, so resuming a held offline sale doesn't duplicate it in the queue.
	pendingOfflineId: "",
	// Order-level ("additional") discount — maps to Sales Invoice's
	// apply_discount_on / additional_discount_percentage fields.
	discountOn: "",
	discountPercentage: "",
	// Pricing Rule engine state (easy_pos.api.pricing.get_cart_pricing) — a
	// typed coupon code, and Product Discount "free item" lines the engine
	// added, kept separate from `items` so a free line never collides with a
	// manually-added line of the same item_code.
	couponCode: "",
	freeItems: [],
	// Selected customer's Loyalty Program enrollment + live points balance
	// (easy_pos.api.loyalty.get_customer_loyalty_summary) — kept on the cart so
	// both the Cart badge and InvoicePay's redeem UI share one fetch instead of
	// querying independently. Reset whenever the customer changes.
	loyaltyProgram: "",
	loyaltyPointsBalance: 0,
	loyaltyConversionFactor: 0,
	loyaltyTierName: "",
	// Selected customer's customer_group/territory — needed by
	// utils/pricingEngine.js to match a Pricing Rule's applicable_for scoping
	// locally. Populated from api/Customer.js's fetchCustomerWithLoyalty
	// response alongside the loyalty fields above, so this never needs its own
	// fetch either.
	customerGroup: "",
	territory: "",
};

const useCartStore = create((set, get) => ({
	...initialState,

	// `precision` is the site's Currency Precision (posSessionStore.currencyPrecision,
	// defaults to 2) — passed by the caller so amount math stays consistent with
	// what the backend will round to on save.
	addItem: (item_code, rate, qty = 1, meta = {}, precision = 2) => {
		const items = get().items;
		// Serial/Batch-tracked items are one physical unit per cart row — each
		// scan/add picks its own serial/batch no, so unlike a plain item, a
		// repeat add can never merge qty into an existing row. It always appends
		// a fresh row (qty forced to 1, ignoring whatever qty was passed) so the
		// cashier scans/selects the serial or batch no for that new row next.
		const isSerialOrBatchTracked = !!meta.has_serial_no || !!meta.has_batch_no;
		const existingItem =
			!isSerialOrBatchTracked &&
			items.find(
				(item) => item.item_code === item_code && !item.has_serial_no && !item.has_batch_no
			);
		const addedQty = isSerialOrBatchTracked ? 1 : qty;
		const updatedItems = existingItem
			? items.map((item) =>
					item.item_code === item_code && !item.has_serial_no && !item.has_batch_no
						? {
								...item,
								qty: item.qty + addedQty,
								rate,
								amount: flt((item.qty + addedQty) * rate, precision),
						  }
						: item
			  )
			: [
					...items,
					{
						item_code,
						qty: addedQty,
						rate,
						amount: flt(addedQty * rate, precision),
						has_serial_no: !!meta.has_serial_no,
						has_batch_no: !!meta.has_batch_no,
						serial_no: meta.serial_no ?? "",
						batch_no: meta.batch_no ?? "",
						// Display-only — a Product Bundle parent item (easy_pos.api.item's
						// is_product_bundle flag). ERPNext explodes it into packed_items
						// itself on save; this only drives the cart line's bundle badge
						// and read-only component preview.
						is_product_bundle: !!meta.is_product_bundle,
						// Item Group — carried on the row (display-only otherwise) purely
						// so utils/pricingEngine.js can match Item Group-scoped Pricing
						// Rules against this line without a second lookup.
						item_group: meta.item_group ?? "",
						// Item-level discount, independent of the cart/order-level discount —
						// populated by applyPricing() from the Pricing Rule engine, or left
						// at 0 until the next pricing fetch resolves (see PP-01/PP-02 for
						// when rate/discount stay hand-editable instead).
						discount_amount: 0,
						discount_percentage: 0,
						price_list_rate: rate,
						pricing_rules: [],
						// Item Tax Template link (sent to create_invoice so ERPNext's own
						// calculate_taxes_and_totals applies the item-wise override) and
						// its resolved {account_head: rate} map (client-side tax preview
						// only — see easy_pos.api.item._get_item_tax_map).
						item_tax_template: meta.item_tax_template ?? "",
						item_tax_rate: meta.item_tax_rate ?? {},
					},
			  ];
		set({ items: updatedItems });
	},

	removeItem: (index) => {
		set({ items: get().items.filter((_, i) => i !== index) });
	},

	updateItemField: (index, field, value) => {
		set({
			items: get().items.map((item, i) =>
				i === index ? { ...item, [field]: value } : item
			),
		});
	},

	// Serial-tracked rows are pinned at qty 1 — a row is one scanned unit
	// (one serial no can't cover more than one), so adding another unit means
	// adding another row (see addItem above), never bumping this one.
	// Batch-tracked rows are NOT pinned — a single batch no can cover any
	// quantity (e.g. 5 litres of milk from one batch), so this is exactly how
	// a cashier sets that quantity without having to re-scan/re-add the item
	// once per litre; only which row a scan/add lands in is decided by addItem.
	updateItemQty: (index, qty, precision = 2) => {
		set({
			items: get().items.map((item, i) => {
				if (i !== index) return item;
				const nextQty = item.has_serial_no ? 1 : Math.max(qty, 1);
				return { ...item, qty: nextQty, amount: flt(nextQty * item.rate, precision) };
			}),
		});
	},

	updateItemQtyByCode: (item_code, qty, precision = 2) => {
		const nextQty = Math.max(qty, 1);
		set({
			items: get().items.map((item) =>
				item.item_code === item_code && !item.has_serial_no && !item.has_batch_no
					? { ...item, qty: nextQty, amount: flt(nextQty * item.rate, precision) }
					: item
			),
		});
	},

	// Counterpart to addItem's "always a new row" behavior for serial/batch
	// items — the Items grid's per-card "−" step removes the most recently
	// added row for that item_code instead of decrementing a qty that's
	// always 1.
	removeLastItemByCode: (item_code) => {
		const items = get().items;
		const lastIndex = items.reduce(
			(acc, item, i) => (item.item_code === item_code ? i : acc),
			-1
		);
		if (lastIndex === -1) return;
		set({ items: items.filter((_, i) => i !== lastIndex) });
	},

	clearItems: () => set({ items: [], freeItems: [], couponCode: "" }),

	setCouponCode: (couponCode) => set({ couponCode }),

	// Merges easy_pos.api.pricing.get_cart_pricing's response onto the cart —
	// per-item rate/discount from whatever Pricing Rules matched, plus the
	// engine's current set of Product Discount "free item" lines (fully
	// replaced each call, so a line that stops qualifying — eg. qty dropped
	// below a rule's min_qty — disappears on the next fetch instead of
	// staying stuck applied).
	applyPricing: (pricingResult, precision = 2) => {
		if (!pricingResult) return;
		const priced = new Map((pricingResult.items ?? []).map((p) => [p.item_code, p]));
		set((state) => ({
			items: state.items.map((item) => {
				const p = priced.get(item.item_code);
				if (!p || p.error) return item;
				const rate = p.rate ?? item.rate;
				return {
					...item,
					rate,
					price_list_rate: p.price_list_rate ?? item.price_list_rate,
					discount_percentage: p.discount_percentage ?? 0,
					discount_amount: p.discount_amount ?? 0,
					pricing_rules: p.pricing_rules ?? [],
					amount: flt(item.qty * rate, precision),
				};
			}),
			freeItems: (pricingResult.free_items ?? []).map((f) => ({ ...f, amount: 0 })),
		}));
	},

	setCustomer: (customer, customerName = "") =>
		set({
			customer,
			customerName,
			loyaltyProgram: "",
			loyaltyPointsBalance: 0,
			loyaltyConversionFactor: 0,
			loyaltyTierName: "",
			customerGroup: "",
			territory: "",
		}),
	clearCustomer: () =>
		set({
			customer: "",
			customerName: "",
			loyaltyProgram: "",
			loyaltyPointsBalance: 0,
			loyaltyConversionFactor: 0,
			loyaltyTierName: "",
			customerGroup: "",
			territory: "",
		}),

	// `customer` is easy_pos.api.customer.get_customer_with_loyalty's response
	// (the full Customer doc + loyalty_points/loyalty_conversion_factor/
	// loyalty_tier_name folded on) — sets the selected customer, its loyalty
	// summary, and its customer_group/territory (for the local pricing engine)
	// from one fetch, in one go.
	setCustomerWithLoyalty: (customer) =>
		set({
			customer: customer?.name || "",
			customerName: customer?.customer_name || customer?.name || "",
			loyaltyProgram: customer?.loyalty_program || "",
			loyaltyPointsBalance: customer?.loyalty_points || 0,
			loyaltyConversionFactor: customer?.loyalty_conversion_factor || 0,
			loyaltyTierName: customer?.loyalty_tier_name || "",
			customerGroup: customer?.customer_group || "",
			territory: customer?.territory || "",
		}),

	setLoyaltySummary: (summary) =>
		set({
			loyaltyProgram: summary?.loyalty_program || "",
			loyaltyPointsBalance: summary?.loyalty_points || 0,
			loyaltyConversionFactor: summary?.conversion_factor || 0,
			loyaltyTierName: summary?.tier_name || "",
		}),

	setPayments: (payments) => set({ payments }),
	updatePayment: (mode_of_payment, amount) => {
		const payments = get().payments;
		const existing = payments.find((row) => row.mode_of_payment === mode_of_payment);
		const updatedPayments = existing
			? payments.map((row) =>
					row.mode_of_payment === mode_of_payment ? { ...row, amount } : row
			  )
			: [...payments, { mode_of_payment, amount }];
		set({ payments: updatedPayments });
	},

	setSalesInvoiceName: (salesInvoiceName) => set({ salesInvoiceName }),
	setPendingOfflineId: (pendingOfflineId) => set({ pendingOfflineId }),

	setDiscountOn: (discountOn) => set({ discountOn }),
	setDiscountPercentage: (discountPercentage) => set({ discountPercentage }),

	loadDraft: (draft, pendingOfflineId = "") => {
		set({
			customer: draft.customer ?? "",
			customerName: draft.customer_name ?? draft.customer ?? "",
			items: draft.items ?? [],
			payments: draft.payments ?? [],
			salesInvoiceName: draft.name ?? "",
			pendingOfflineId,
			discountOn: draft.discountOn ?? "",
			discountPercentage: draft.discountPercentage ?? "",
			couponCode: "",
			freeItems: [],
			loyaltyProgram: "",
			loyaltyPointsBalance: 0,
			loyaltyConversionFactor: 0,
			loyaltyTierName: "",
			customerGroup: "",
			territory: "",
		});
	},

	resetCart: () => set({ ...initialState }),
}));

export default useCartStore;
