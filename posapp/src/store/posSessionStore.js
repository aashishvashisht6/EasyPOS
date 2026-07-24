import { create } from "zustand";
import { fetchOpeningEntry } from "../api/OpeningEntry";
import { fetchProfile } from "../api/POSProfile";
import { fetchCurrencySymbol } from "../api/Currency";

const DEFAULT_CURRENCY = "INR";
const DEFAULT_SYMBOL = "₹";

const usePOSSessionStore = create((set, get) => ({
  hasOpeningEntry: false,
  openingDetail: {},
  loading: true,
  openingModalOpen: false,
  currencyCode: DEFAULT_CURRENCY,
  currencySymbol: DEFAULT_SYMBOL,

  loadCurrencyForProfile: async (pos_profile) => {
    if (!pos_profile) return;
    const profile = await fetchProfile(pos_profile);
    const currency = profile?.currency || DEFAULT_CURRENCY;
    if (currency === get().currencyCode) return;
    const symbol = await fetchCurrencySymbol(currency);
    set({ currencyCode: currency, currencySymbol: symbol });
  },

  checkOpeningEntry: async (userEmail) => {
    if (!userEmail) {
      set({ loading: false });
      return;
    }
    const data = await fetchOpeningEntry(userEmail);
    if (data && data.pos_profile) {
      set({ hasOpeningEntry: true, openingDetail: data, loading: false });
      get().loadCurrencyForProfile(data.pos_profile);
    } else {
      set({ hasOpeningEntry: false, openingDetail: {}, loading: false });
    }
  },

  setOpeningEntry: (openingDetails) => {
    if (openingDetails?.name) {
      set({ hasOpeningEntry: true, openingDetail: openingDetails });
      get().loadCurrencyForProfile(openingDetails.pos_profile);
    }
  },

  clearOpeningEntry: () => {
    set({ hasOpeningEntry: false, openingDetail: {} });
  },

  openOpeningModal: () => set({ openingModalOpen: true }),
  closeOpeningModal: () => set({ openingModalOpen: false }),
}));

export default usePOSSessionStore;
