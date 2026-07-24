import { create } from "zustand";
import { fetchOpeningEntry } from "../api/OpeningEntry";
import { fetchProfile } from "../api/POSProfile";
import { fetchCurrencySymbol } from "../api/Currency";
import { fetchPrecisionSettings } from "../api/Invoice";

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

  loadProfileDetails: async (pos_profile) => {
    if (!pos_profile) return;
    const [profile, precisionSettings] = await Promise.all([
      fetchProfile(pos_profile),
      fetchPrecisionSettings(),
    ]);
    if (!profile) return;
    const currency = profile.currency || DEFAULT_CURRENCY;
    const symbol =
      currency === get().currencyCode ? get().currencySymbol : await fetchCurrencySymbol(currency);
    set({
      currencyCode: currency,
      currencySymbol: symbol,
      currencyPrecision: precisionSettings?.currency_precision ?? DEFAULT_CURRENCY_PRECISION,
      floatPrecision: precisionSettings?.float_precision ?? DEFAULT_FLOAT_PRECISION,
      warehouse: profile.warehouse || "",
      priceList: profile.selling_price_list || "",
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
    set({ hasOpeningEntry: false, openingDetail: {}, warehouse: "", priceList: "" });
  },

  openOpeningModal: () => set({ openingModalOpen: true }),
  closeOpeningModal: () => set({ openingModalOpen: false }),
}));

export default usePOSSessionStore;
