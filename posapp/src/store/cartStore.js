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
            // Item-level discount, independent of the cart/order-level discount.
            discount_amount: 0,
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

  clearItems: () => set({ items: [] }),

  setCustomer: (customer) => set({ customer }),
  clearCustomer: () => set({ customer: "" }),

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
    });
  },

  resetCart: () => set({ ...initialState }),
}));

export default useCartStore;
