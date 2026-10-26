import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import usePOSSessionStore from "../store/posSessionStore";
import { fetchCurrencyFormats } from "../api/Currency";
import { formatCurrency } from "../utils/format";

// Returns `money(value, currency?, precision?)` — formats an amount with the
// currency's own symbol/digit grouping (utils/format.js's formatCurrency).
// Omitting `currency` (or passing the open shift's) uses the session's format
// with no fetch; pass `currencies` up front for any other currency a page
// will render (e.g. each invoice's own `currency` on a list page) so their
// formats are fetched once — until they arrive, the currency code stands in
// for the symbol rather than showing the wrong currency's symbol.
const useCurrencyFormatter = (currencies = []) => {
	const session = usePOSSessionStore(
		useShallow((s) => ({
			currency: s.currencyCode,
			symbol: s.currencySymbol,
			number_format: s.numberFormat,
			symbol_on_right: s.symbolOnRight,
			precision: s.currencyPrecision,
		}))
	);
	const [formats, setFormats] = useState({});

	const wanted = [...new Set(currencies.filter((c) => c && c !== session.currency))]
		.sort()
		.join(",");
	useEffect(() => {
		if (!wanted) return;
		let cancelled = false;
		fetchCurrencyFormats(wanted.split(",")).then((fetched) => {
			if (!cancelled) setFormats((prev) => ({ ...prev, ...fetched }));
		});
		return () => {
			cancelled = true;
		};
	}, [wanted]);

	return useMemo(
		() =>
			(value, currency, precision = session.precision) => {
				const fmt =
					!currency || currency === session.currency
						? session
						: formats[currency] ?? {
								symbol: `${currency} `,
								number_format: session.number_format,
						  };
				return formatCurrency(value ?? 0, fmt, precision);
			},
		[session, formats]
	);
};

export default useCurrencyFormatter;
