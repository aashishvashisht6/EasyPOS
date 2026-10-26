import { __, _t, getLanguage } from "../translation";

// UI language -> date locale (see src/translation). Dates follow the cashier's
// chosen language; amounts follow the currency (formatCurrency below).
// Arabic and Persian keep Latin digits (-u-nu-latn) so dates match the amounts beside
// them, which follow the currency's own number format.
// Every locale is pinned to the Gregorian calendar (-u-ca-gregory) so dates match
// ERPNext's posting dates; fa would otherwise show Solar Hijri and th the Buddhist era.
const DATE_LOCALES = {
	en: "en-US",
	hi: "hi-IN",
	ar: "ar-u-ca-gregory-nu-latn",
	fa: "fa-u-ca-gregory-nu-latn",
};
export const dateLocale = () => {
	const language = getLanguage() || "en";
	return DATE_LOCALES[language] || `${language}-u-ca-gregory`;
};

export const formatDate = (value) => {
	if (!value) return "";
	return new Date(value).toLocaleDateString(dateLocale(), {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
};

// Sales Invoice statuses (ERPNext's own values) — marked so the extractor
// catalogs them; render the badge text with invoiceStatusLabel, never raw.
_t("Draft");
_t("Paid");
_t("Unpaid");
_t("Overdue");
_t("Partly Paid");
_t("Return");
_t("Credit Note Issued");
_t("Cancelled");
_t("Submitted");
_t("Unpaid and Discounted");
_t("Overdue and Discounted");
_t("Partly Paid and Discounted");
_t("Consolidated");
_t("Internal Transfer");
export const invoiceStatusLabel = (status) => (status ? __(status) : "");

// Sales Taxes and Charges charge_type values (ERPNext's own), shown on tax rows.
_t("Actual");
_t("On Net Total");
_t("On Previous Row Amount");
_t("On Previous Row Total");
_t("On Item Quantity");
export const chargeTypeLabel = (chargeType) => (chargeType ? __(chargeType) : "");

// Sales Invoice status -> pos-badge-* modifier class (see theme/components.css).
export const invoiceStatusBadgeClass = (status) => {
	switch (status) {
		case "Paid":
			return "pos-badge pos-badge-paid";
		case "Unpaid":
		case "Unpaid and Discounted":
			return "pos-badge pos-badge-unpaid";
		case "Overdue":
		case "Overdue and Discounted":
			return "pos-badge pos-badge-overdue";
		default:
			return "pos-badge";
	}
};

// Frappe's Number Format options (Currency.number_format / System Settings) ->
// separators, mirroring frappe's own get_number_format_info. Digit grouping
// follows the currency itself (e.g. INR's lakh/crore "#,##,###.##" vs USD's
// "#,###.##" vs EUR's "#.###,##"), never a hardcoded locale.
const NUMBER_FORMATS = {
	"#,###.##": { decimal: ".", group: "," },
	"#.###,##": { decimal: ",", group: "." },
	"# ###.##": { decimal: ".", group: " " },
	"# ###,##": { decimal: ",", group: " " },
	"#'###.##": { decimal: ".", group: "'" },
	"#, ###.##": { decimal: ".", group: ", " },
	"#,##,###.##": { decimal: ".", group: ",", indian: true },
	"#,###.###": { decimal: ".", group: "," },
	"#.###": { decimal: ",", group: "." },
	"#,###": { decimal: ".", group: "," },
	"#.########": { decimal: ".", group: "" },
};
export const DEFAULT_NUMBER_FORMAT = "#,###.##";

const groupDigits = (digits, { group, indian }) => {
	if (!group || digits.length <= 3) return digits;
	if (indian) {
		const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, group);
		return `${head}${group}${digits.slice(-3)}`;
	}
	return digits.replace(/\B(?=(\d{3})+(?!\d))/g, group);
};

export const formatNumber = (value, numberFormat = DEFAULT_NUMBER_FORMAT, precision = 2) => {
	const info = NUMBER_FORMATS[numberFormat] || NUMBER_FORMATS[DEFAULT_NUMBER_FORMAT];
	const num = Number(value) || 0;
	const [intPart, fracPart] = Math.abs(num).toFixed(precision).split(".");
	const negative = num < 0 && Number(Math.abs(num).toFixed(precision)) !== 0;
	return `${negative ? "-" : ""}${groupDigits(intPart, info)}${
		fracPart ? info.decimal + fracPart : ""
	}`;
};

// `fmt` is a currency format as returned by easy_pos.api.currency
// ({ symbol, number_format, symbol_on_right }) — see hooks/useCurrencyFormatter.
export const formatCurrency = (value, fmt = {}, precision = 2) => {
	const formatted = formatNumber(value, fmt.number_format, precision);
	const negative = formatted.startsWith("-");
	const digits = negative ? formatted.slice(1) : formatted;
	const symbol = fmt.symbol ?? "";
	const body = fmt.symbol_on_right ? `${digits} ${symbol}`.trim() : `${symbol}${digits}`;
	return negative ? `-${body}` : body;
};
