import { create } from "zustand";
import { flt } from "../utils/number";

const initialState = {
  customer: "",
  items: [],
  payments: [],
  salesInvoiceName: "",
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
};

const useCartStore = create((set, get) => ({
  ...initialState,

  // `precision` is the site's Currency Precision (posSessionStore.currencyPrecision,
  // defaults to 2) — passed by the caller so amount math stays consistent with
  // what the backend will round to on save.
  addItem: (item_code, rate, qty = 1, meta = {}, precision = 2) => {
    const items = get().items;
    const existingItem = items.find((item) => item.item_code === item_code);
    const updatedItems = existingItem
      ? items.map((item) =>
          item.item_code === item_code
            ? { ...item, qty: item.qty + qty, rate, amount: flt((item.qty + qty) * rate, precision) }
            : item,
        )
      : [
          ...items,
          {
            item_code,
            qty,
            rate,
            amount: flt(qty * rate, precision),
            has_serial_no: !!meta.has_serial_no,
            has_batch_no: !!meta.has_batch_no,
            serial_no: meta.serial_no ?? "",
            batch_no: meta.batch_no ?? "",
            // Display-only — a Product Bundle parent item (easy_pos.api.item's
            // is_product_bundle flag). ERPNext explodes it into packed_items
            // itself on save; this only drives the cart line's bundle badge
            // and read-only component preview.
            is_product_bundle: !!meta.is_product_bundle,
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
        i === index ? { ...item, [field]: value } : item,
      ),
    });
  },

  updateItemQty: (index, qty, precision = 2) => {
    const nextQty = Math.max(qty, 1);
    set({
      items: get().items.map((item, i) =>
        i === index ? { ...item, qty: nextQty, amount: flt(nextQty * item.rate, precision) } : item,
      ),
    });
  },

  updateItemQtyByCode: (item_code, qty, precision = 2) => {
    const nextQty = Math.max(qty, 1);
    set({
      items: get().items.map((item) =>
        item.item_code === item_code
          ? { ...item, qty: nextQty, amount: flt(nextQty * item.rate, precision) }
          : item,
      ),
    });
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

  setCustomer: (customer) =>
    set({
      customer,
      loyaltyProgram: "",
      loyaltyPointsBalance: 0,
      loyaltyConversionFactor: 0,
      loyaltyTierName: "",
    }),
  clearCustomer: () =>
    set({
      customer: "",
      loyaltyProgram: "",
      loyaltyPointsBalance: 0,
      loyaltyConversionFactor: 0,
      loyaltyTierName: "",
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
          row.mode_of_payment === mode_of_payment ? { ...row, amount } : row,
        )
      : [...payments, { mode_of_payment, amount }];
    set({ payments: updatedPayments });
  },

  setSalesInvoiceName: (salesInvoiceName) => set({ salesInvoiceName }),

  setDiscountOn: (discountOn) => set({ discountOn }),
  setDiscountPercentage: (discountPercentage) => set({ discountPercentage }),

  loadDraft: (draft) => {
    set({
      customer: draft.customer ?? "",
      items: draft.items ?? [],
      payments: draft.payments ?? [],
      salesInvoiceName: draft.name ?? "",
      discountOn: draft.discountOn ?? "",
      discountPercentage: draft.discountPercentage ?? "",
      couponCode: "",
      freeItems: [],
      loyaltyProgram: "",
      loyaltyPointsBalance: 0,
      loyaltyConversionFactor: 0,
      loyaltyTierName: "",
    });
  },

  resetCart: () => set({ ...initialState }),
}));

export default useCartStore;
