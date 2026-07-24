// Mirrors Frappe's flt(value, precision) rounding — exponential notation
// avoids the classic (0.1 + 0.2).toFixed(2) style float artifacts that plain
// multiply/Math.round/divide can introduce.
export const flt = (value, precision = 2) => {
  const num = typeof value === "number" ? value : parseFloat(value);
  if (Number.isNaN(num)) return 0;
  return Number(`${Math.round(Number(`${num}e${precision}`))}e-${precision}`);
};

// Currency amounts (rate, amount, discount, totals) — round to the site's
// Currency Precision (posSessionStore.currencyPrecision).
export const roundCurrency = (value, precision) => flt(value, precision);

// Float fields (qty, discount percentage) — round to Float Precision
// (posSessionStore.floatPrecision).
export const roundQty = (value, precision) => flt(value, precision);
