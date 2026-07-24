import { create } from "zustand";
import { fetchOpeningEntry } from "../api/OpeningEntry";
import { fetchProfile } from "../api/POSProfile";
import { fetchCurrencySymbol } from "../api/Currency";
import { fetchPrecisionSettings } from "../api/Invoice";
import { fetchTaxesAndChargesTemplate } from "../api/Tax";

const DEFAULT_CURRENCY = "INR";
const DEFAULT_SYMBOL = "₹";
// Frappe's own System Settings defaults (see easy_pos.api.pos.get_precision_settings).
const DEFAULT_CURRENCY_PRECISION = 2;
const DEFAULT_FLOAT_PRECISION = 3;

const usePOSSessionStore = create((set, get) => ({
  hasOpeningEntry: false,
  openingDetail: {},
  loading: true,
  openingModalOpen: false,
  currencyCode: DEFAULT_CURRENCY,
  currencySymbol: DEFAULT_SYMBOL,
  // System Settings' Currency/Float Precision (or the number-format-derived
  // equivalent) — same resolution ERPNext itself uses, fetched once per shift
  // so amount rounding/display matches what the Sales Invoice will persist.
  currencyPrecision: DEFAULT_CURRENCY_PRECISION,
  floatPrecision: DEFAULT_FLOAT_PRECISION,
  // Stock/rate on the terminal are resolved from these — both stay "" until an
  // Opening Entry exists, so items show with no stock/rate until then.
  warehouse: "",
  priceList: "",
  // Order-level tax template + its resolved rows (see api/Tax.js) — POS
  // invoices don't get taxes auto-populated server-side, so the terminal
  // fetches these once per shift to preview and later submit the invoice's
  // own `taxes` table (easy_pos.api.pos.create_invoice).
  taxesAndCharges: "",
  taxTemplateRows: [],

  loadProfileDetails: async (pos_profile) => {
    if (!pos_profile) return;
    const [profile, precisionSettings] = await Promise.all([
      fetchProfile(pos_profile),
      fetchPrecisionSettings(),
    ]);
    if (!profile) return;
    const currency = profile.currency || DEFAULT_CURRENCY;
    const [symbol, taxTemplateRows] = await Promise.all([
      currency === get().currencyCode ? get().currencySymbol : fetchCurrencySymbol(currency),
      fetchTaxesAndChargesTemplate(profile.taxes_and_charges),
    ]);
    set({
      currencyCode: currency,
      currencySymbol: symbol,
      currencyPrecision: precisionSettings?.currency_precision ?? DEFAULT_CURRENCY_PRECISION,
      floatPrecision: precisionSettings?.float_precision ?? DEFAULT_FLOAT_PRECISION,
      warehouse: profile.warehouse || "",
      priceList: profile.selling_price_list || "",
      taxesAndCharges: profile.taxes_and_charges || "",
      taxTemplateRows,
    });
  },

  checkOpeningEntry: async (userEmail) => {
    if (!userEmail) {
      set({ loading: false });
      return;
    }
    const data = await fetchOpeningEntry(userEmail);
    if (data && data.pos_profile) {
      set({ hasOpeningEntry: true, openingDetail: data, loading: false });
      get().loadProfileDetails(data.pos_profile);
    } else {
      set({ hasOpeningEntry: false, openingDetail: {}, loading: false });
    }
  },

  setOpeningEntry: (openingDetails) => {
    if (openingDetails?.name) {
      set({ hasOpeningEntry: true, openingDetail: openingDetails });
      get().loadProfileDetails(openingDetails.pos_profile);
    }
  },

  clearOpeningEntry: () => {
    set({
      hasOpeningEntry: false,
      openingDetail: {},
      warehouse: "",
      priceList: "",
      taxesAndCharges: "",
      taxTemplateRows: [],
    });
  },

  openOpeningModal: () => set({ openingModalOpen: true }),
  closeOpeningModal: () => set({ openingModalOpen: false }),
}));

export default usePOSSessionStore;
