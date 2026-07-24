import { create } from "zustand";

const initialState = {
  customer: "",
  items: [],
  payments: [],
  salesInvoiceName: "",
};

const useCartStore = create((set, get) => ({
  ...initialState,

  addItem: (item_code, rate, qty = 1, meta = {}) => {
    const items = get().items;
    const existingItem = items.find((item) => item.item_code === item_code);
    const updatedItems = existingItem
      ? items.map((item) =>
          item.item_code === item_code
            ? { ...item, qty: item.qty + qty, rate, amount: (item.qty + qty) * rate }
            : item,
        )
      : [
          ...items,
          {
            item_code,
            qty,
            rate,
            amount: qty * rate,
            has_serial_no: !!meta.has_serial_no,
            has_batch_no: !!meta.has_batch_no,
            serial_no: "",
            batch_no: "",
            // Item-level discount, independent of the cart/order-level discount.
            discount_amount: 0,
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

  updateItemQty: (index, qty) => {
    const nextQty = Math.max(qty, 1);
    set({
      items: get().items.map((item, i) =>
        i === index ? { ...item, qty: nextQty, amount: nextQty * item.rate } : item,
      ),
    });
  },

  updateItemQtyByCode: (item_code, qty) => {
    const nextQty = Math.max(qty, 1);
    set({
      items: get().items.map((item) =>
        item.item_code === item_code
          ? { ...item, qty: nextQty, amount: nextQty * item.rate }
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

  loadDraft: (draft) => {
    set({
      customer: draft.customer ?? "",
      items: draft.items ?? [],
      payments: draft.payments ?? [],
      salesInvoiceName: draft.name ?? "",
    });
  },

  resetCart: () => set({ ...initialState }),
}));

export default useCartStore;
