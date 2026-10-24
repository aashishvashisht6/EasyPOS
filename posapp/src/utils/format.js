import i18n, { _t } from "../i18n";

// UI language -> date locale (see src/i18n). Dates follow the cashier's
// chosen language. Arabic keeps Latin digits (-u-nu-latn) so dates match the
// amounts beside them.
const DATE_LOCALES = { en: "en-US", hi: "hi-IN", ar: "ar-u-nu-latn" };
export const dateLocale = () => DATE_LOCALES[i18n.language] || i18n.language || "en-US";

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
_t("Draft"); _t("Paid"); _t("Unpaid"); _t("Overdue"); _t("Partly Paid"); _t("Return"); _t("Credit Note Issued");
_t("Cancelled"); _t("Submitted"); _t("Unpaid and Discounted"); _t("Overdue and Discounted"); _t("Partly Paid and Discounted");
_t("Consolidated"); _t("Internal Transfer");
export const invoiceStatusLabel = (status) => (status ? i18n.t(status) : "");

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
