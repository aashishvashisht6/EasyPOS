import { create } from "zustand";
import { fetchOpeningEntry } from "../api/OpeningEntry";
import { fetchProfile } from "../api/POSProfile";
import { fetchCurrencyContext } from "../api/Currency";
import { DEFAULT_NUMBER_FORMAT } from "../utils/format";
import { toastError } from "./toastStore";
import { getServerMessage } from "../utils/serverError";
import { fetchPrecisionSettings } from "../api/Invoice";
import { fetchTaxesAndChargesTemplate } from "../api/Tax";
import { fetchPricingRules } from "../api/Pricing";
import { runFullSync } from "../engine/sync";
import useEngineSettingsStore from "../engine/settingsStore";
import useConnectivityStore from "../engine/connectivity";

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
	// Currency.number_format/symbol_on_right for currencyCode — drives digit
	// grouping everywhere via hooks/useCurrencyFormatter (utils/format.js's
	// formatCurrency), so a USD/EUR profile doesn't get INR lakh grouping.
	numberFormat: DEFAULT_NUMBER_FORMAT,
	symbolOnRight: false,
	// The Company's own currency and the invoice-currency -> company-currency
	// rate the shift's invoices post at (easy_pos.api.currency). conversionRate
	// stays 1 for a single-currency shop.
	companyCurrency: DEFAULT_CURRENCY,
	conversionRate: 1,
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
	// Item Code/Item Group-scoped Selling Pricing Rules (api/Pricing.js's
	// fetchPricingRules), fetched once per shift same as taxTemplateRows above —
	// Cart/index.jsx's client-side pricing engine (utils/pricingEngine.js)
	// matches the cart against this instead of calling get_cart_pricing on
	// every add-to-cart. See easy_pos.api.pricing.get_pricing_rules for what's
	// (and isn't) covered.
	pricingRules: [],
	// Pricing-related POS Profile flags/restrictions — fetched once per shift,
	// same as warehouse/priceList above, and unused until the Terminal wires
	// them in (see docs/POS_PRICING_USE_CASES.md, category D).
	posProfile: "",
	ignorePricingRule: false,
	allowRateChange: false,
	allowDiscountChange: false,
	itemGroups: [],
	customerGroups: [],
	// Print Settings — consumed by InvoicePay to auto-open a receipt print
	// preview right after checkout completes.
	printReceiptOnOrderComplete: false,
	printFormat: "",
	// Gates the "Open Customer Display" button on the Terminal — see
	// easy_pos.patches.add_pos_profile_customer_display.
	customerDisplayEnabled: false,

	loadProfileDetails: async (pos_profile) => {
		if (!pos_profile) return;
		const [profile, precisionSettings] = await Promise.all([
			fetchProfile(pos_profile),
			fetchPrecisionSettings(),
		]);
		if (!profile) return;
		const [currencyContext, taxTemplateRows, pricingRules] = await Promise.all([
			fetchCurrencyContext(profile.name || pos_profile).catch((error) => {
				// A missing exchange rate for a multi-currency profile is a config
				// error the cashier/admin must see — not a network blip (offline,
				// the cached profile currency below is still used).
				const message = getServerMessage(error);
				if (message) toastError(message, { duration: 0 });
				else console.error(error);
				return null;
			}),
			fetchTaxesAndChargesTemplate(profile.taxes_and_charges),
			fetchPricingRules(profile.name || pos_profile),
		]);
		const currency = currencyContext?.currency || profile.currency || DEFAULT_CURRENCY;
		set({
			currencyCode: currency,
			currencySymbol:
				currencyContext?.symbol ||
				(currency === DEFAULT_CURRENCY ? DEFAULT_SYMBOL : currency),
			numberFormat: currencyContext?.number_format || DEFAULT_NUMBER_FORMAT,
			symbolOnRight: !!currencyContext?.symbol_on_right,
			companyCurrency: currencyContext?.company_currency || currency,
			conversionRate: currencyContext?.conversion_rate || 1,
			currencyPrecision: precisionSettings?.currency_precision ?? DEFAULT_CURRENCY_PRECISION,
			floatPrecision: precisionSettings?.float_precision ?? DEFAULT_FLOAT_PRECISION,
			warehouse: profile.warehouse || "",
			priceList: profile.selling_price_list || "",
			taxesAndCharges: profile.taxes_and_charges || "",
			taxTemplateRows,
			pricingRules,
			posProfile: profile.name || pos_profile,
			ignorePricingRule: !!profile.ignore_pricing_rule,
			allowRateChange: !!profile.allow_rate_change,
			allowDiscountChange: !!profile.allow_discount_change,
			itemGroups: (profile.item_groups ?? []).map((row) => row.item_group),
			customerGroups: (profile.customer_groups ?? []).map((row) => row.customer_group),
			printReceiptOnOrderComplete: !!profile.print_receipt_on_order_complete,
			printFormat: profile.print_format || "",
			customerDisplayEnabled: !!profile.ep_customer_display_enabled,
		});

		// Fire-and-forget: refreshes the offline cache once per shift-open so a
		// later unexpected connectivity drop has recent master data to fall back
		// to. Never blocks the terminal on this — a failed/slow sync here must
		// not delay showing the terminal (see engine/sync.js's runFullSync).
		const { offlineModeEnabled } = useEngineSettingsStore.getState();
		if (offlineModeEnabled && useConnectivityStore.getState().isOnline) {
			runFullSync(profile.name || pos_profile).catch((error) => console.error(error));
		}
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
			pricingRules: [],
			posProfile: "",
			ignorePricingRule: false,
			allowRateChange: false,
			allowDiscountChange: false,
			itemGroups: [],
			customerGroups: [],
			printReceiptOnOrderComplete: false,
			printFormat: "",
			customerDisplayEnabled: false,
		});
	},

	openOpeningModal: () => set({ openingModalOpen: true }),
	closeOpeningModal: () => set({ openingModalOpen: false }),
}));

export default usePOSSessionStore;
