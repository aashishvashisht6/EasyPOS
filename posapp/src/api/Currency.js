import { engineGet } from "../engine";

// Per-shift currency context for a POS Profile: invoice currency, exchange
// rate to the Company's currency, and display format. See
// easy_pos.api.currency.get_currency_context — that call throws when the
// exchange rate can't be resolved, so this propagates (no swallow) for the
// caller to surface the message.
export const fetchCurrencyContext = async (pos_profile) => {
	const response = await engineGet("/api/method/easy_pos.api.currency.get_currency_context", {
		params: { pos_profile },
	});
	return response.data.message;
};

// Module-level cache — a currency's display format never changes mid-session,
// and list pages ask for the same few currencies on every page/filter change.
const formatCache = new Map();

// { [currency]: { currency, symbol, number_format, symbol_on_right } } for
// documents that may be in a currency other than the open shift's.
export const fetchCurrencyFormats = async (currencies) => {
	const missing = [...new Set(currencies.filter((c) => c && !formatCache.has(c)))];
	if (missing.length) {
		try {
			const response = await engineGet(
				"/api/method/easy_pos.api.currency.get_currency_formats",
				{
					params: { currencies: JSON.stringify(missing) },
				}
			);
			Object.entries(response.data.message ?? {}).forEach(([code, fmt]) =>
				formatCache.set(code, fmt)
			);
		} catch (error) {
			console.error(error);
		}
	}
	return Object.fromEntries(
		currencies.filter((c) => formatCache.has(c)).map((c) => [c, formatCache.get(c)])
	);
};
