import { roundCurrency } from "./number";

// Pre-save preview of order-level ("Sales Taxes and Charges") rows, mirroring
// erpnext.controllers.taxes_and_totals.calculate_taxes closely enough for the
// terminal to show a live total — the Sales Invoice's own
// calculate_taxes_and_totals remains authoritative once the invoice is saved.
// `netTotal` is the taxable base (item total after item-level discounts, but
// before the order-level additional discount — same as ERPNext computes
// taxes on net_total ahead of any additional_discount_percentage).
export const computeTaxes = (taxTemplateRows, cartItems, netTotal, precision) => {
  if (!taxTemplateRows?.length) return [];

  const rows = taxTemplateRows.map((row) => ({ ...row, tax_amount: 0, total: 0 }));

  rows.forEach((row, idx) => {
    const rowNo = parseInt(row.row_id, 10) || idx; // 1-based row_id → previous row's 0-based index
    let taxAmount;

    switch (row.charge_type) {
      case "On Net Total":
        taxAmount = cartItems.reduce((sum, item) => {
          const rate = item.item_tax_rate?.[row.account_head] ?? row.rate ?? 0;
          return sum + ((item.amount ?? 0) * rate) / 100;
        }, 0);
        break;

      case "On Item Quantity":
        taxAmount = cartItems.reduce((sum, item) => {
          const rate = item.item_tax_rate?.[row.account_head] ?? row.rate ?? 0;
          return sum + (item.qty ?? 0) * rate;
        }, 0);
        break;

      case "On Previous Row Amount":
        taxAmount = ((rows[rowNo - 1]?.tax_amount ?? 0) * (row.rate ?? 0)) / 100;
        break;

      case "On Previous Row Total": {
        const refTotal = rowNo > 0 ? rows[rowNo - 1]?.total ?? netTotal : netTotal;
        taxAmount = (refTotal * (row.rate ?? 0)) / 100;
        break;
      }

      case "Actual":
      default:
        taxAmount = row.tax_amount || 0;
        break;
    }

    row.tax_amount = roundCurrency(taxAmount, precision);
    const prevTotal = idx === 0 ? netTotal : rows[idx - 1].total;
    row.total = roundCurrency(prevTotal + row.tax_amount, precision);
  });

  return rows;
};

export const sumTaxAmount = (taxRows) =>
  taxRows.reduce((sum, row) => sum + (row.tax_amount ?? 0), 0);

// Full cart total incl. the order-level ("additional") discount's interaction
// with tax — mirrors erpnext.controllers.taxes_and_totals.apply_discount_amount,
// which does NOT just compute tax once and subtract the discount from the
// post-tax grand total. It distributes the discount pro-rata across each
// item's net amount and recomputes tax on the *reduced* total — for both
// apply_discount_on options, not only "Net Total". The two options differ
// only in what the discount % is taken against
// (get_total_for_discount_amount): net_total for "Net Total", the pre-discount
// grand_total (minus any flat Actual/On Item Quantity charges, which don't
// shrink with a discount) for "Grand Total".
export const computeCartTotals = ({
  items,
  taxTemplateRows,
  netTotal,
  discountOn,
  discountPercentage,
  precision,
}) => {
  const firstPassTaxRows = computeTaxes(taxTemplateRows, items, netTotal, precision);
  const firstPassTax = sumTaxAmount(firstPassTaxRows);
  const grandTotalBeforeDiscount = roundCurrency(netTotal + firstPassTax, precision);

  const pct = parseFloat(discountPercentage) || 0;
  if (!discountOn || !pct) {
    return {
      taxRows: firstPassTaxRows,
      totalTax: firstPassTax,
      discountAmount: 0,
      netTotal,
      grandTotal: grandTotalBeforeDiscount,
    };
  }

  const fixedCharges = firstPassTaxRows
    .filter((row) => row.charge_type === "Actual" || row.charge_type === "On Item Quantity")
    .reduce((sum, row) => sum + (row.tax_amount ?? 0), 0);
  const discountBase = discountOn === "Net Total" ? netTotal : grandTotalBeforeDiscount - fixedCharges;
  const discountAmount = roundCurrency((discountBase * pct) / 100, precision);

  // Same proportional factor applies to every item (the denominator isn't
  // item-specific), so scaling the aggregate net total and each item's
  // amount by it gives the same result as ERPNext's per-item distribution.
  const scaleFactor = discountBase ? 1 - discountAmount / discountBase : 1;
  const scaledItems = items.map((item) => ({
    ...item,
    amount: roundCurrency((item.amount ?? 0) * scaleFactor, precision),
  }));
  const netTotalAfterDiscount = roundCurrency(netTotal * scaleFactor, precision);

  const taxRows = computeTaxes(taxTemplateRows, scaledItems, netTotalAfterDiscount, precision);
  const totalTax = sumTaxAmount(taxRows);
  const grandTotal = roundCurrency(netTotalAfterDiscount + totalTax, precision);

  return { taxRows, totalTax, discountAmount, netTotal: netTotalAfterDiscount, grandTotal };
};
