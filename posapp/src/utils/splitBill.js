import { roundCurrency, flt } from "./number";
import { computeCartTotals } from "./tax";

// Pure helpers behind Split Bill (components/Cart/SplitBillModal.jsx). The
// split itself lives in cartStore's `split` slice; everything here derives
// per-bill lines/totals/payments from that frozen snapshot.

export const SPLIT_MODES = { ITEM: "item", EVEN: "even", CUSTOM: "custom" };

export const newSplitGroupId = () =>
	typeof crypto !== "undefined" && crypto.randomUUID
		? crypto.randomUUID()
		: `split-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// A serial row is one physical unit and a Product Bundle parent is exploded by
// ERPNext per invoice — both move between bills as whole lines. Everything else
// can have its qty divided across bills (whole units only).
export const isLineQtySplittable = (item) =>
	!item.has_serial_no && !item.is_product_bundle && item.qty > 1;

// Every line starts entirely on the first bill.
export const initialAssignments = (items, firstBillId) =>
	Object.fromEntries(items.map((item, index) => [index, { [firstBillId]: item.qty }]));

export const assignedQty = (assignment) =>
	Object.values(assignment ?? {}).reduce((sum, qty) => sum + (qty || 0), 0);

// Line indexes whose per-bill quantities don't add up to the line's qty.
export const unbalancedLines = (items, assignments) =>
	items
		.map((item, index) => (assignedQty(assignments[index]) === item.qty ? null : index))
		.filter((index) => index !== null);

// The cart line(s) as they go onto one bill. `amount` is recomputed for the
// bill's share of the qty; `discount_amount` is per unit in ERPNext (rate is
// already net of it), so it carries over unchanged.
const billLines = (items, assignments, billId, precision) =>
	items.flatMap((item, index) => {
		const qty = assignments[index]?.[billId] || 0;
		if (!qty) return [];
		return [
			{
				...item,
				qty,
				amount: roundCurrency(qty * item.rate, precision),
			},
		];
	});

// Flat "Actual" tax/charge rows would otherwise be copied whole onto every bill
// (computeTaxes uses an Actual row's tax_amount as-is), so each bill gets a
// share proportional to its net total, with the rounding remainder on the last
// bill so the shares add back up to the original charge. Percentage and
// "On Item Quantity" rows need nothing — they recompute off each bill's own lines.
const prorateActualRows = (taxTemplateRows, billNets, precision) => {
	const totalNet = billNets.reduce((sum, net) => sum + net, 0);
	const lastIndex = billNets.length - 1;
	return billNets.map((net, billIndex) =>
		(taxTemplateRows ?? []).map((row) => {
			if (row.charge_type !== "Actual") return row;
			const full = row.tax_amount || 0;
			if (billIndex < lastIndex) {
				return { ...row, tax_amount: totalNet ? roundCurrency((full * net) / totalNet, precision) : 0 };
			}
			const othersShare = billNets
				.slice(0, lastIndex)
				.reduce((sum, otherNet) => sum + (totalNet ? roundCurrency((full * otherNet) / totalNet, precision) : 0), 0);
			return { ...row, tax_amount: roundCurrency(full - othersShare, precision) };
		}),
	);
};

// Per-bill { items, freeItems, taxes, grandTotal, ... } for a by-item split,
// computed with the same computeCartTotals the cart itself uses.
export const computeBillBreakdown = ({ snapshot, bills, assignments, freeAssignments, taxTemplateRows, precision }) => {
	const linesPerBill = bills.map((bill) => billLines(snapshot.items, assignments, bill.id, precision));
	const netPerBill = linesPerBill.map((lines) =>
		roundCurrency(lines.reduce((sum, line) => sum + (line.amount ?? 0), 0), precision),
	);
	const templatesPerBill = prorateActualRows(taxTemplateRows, netPerBill, precision);

	return bills.map((bill, billIndex) => {
		const items = linesPerBill[billIndex];
		const totals = computeCartTotals({
			items,
			taxTemplateRows: templatesPerBill[billIndex],
			netTotal: netPerBill[billIndex],
			discountOn: snapshot.discountOn,
			discountPercentage: snapshot.discountPercentage,
			precision,
		});
		return {
			bill,
			items,
			freeItems: (snapshot.freeItems ?? []).filter((_, index) => freeAssignments[index] === bill.id),
			taxes: totals.taxRows,
			totalTax: totals.totalTax,
			discountAmount: totals.discountAmount,
			grandTotal: totals.grandTotal,
		};
	});
};

// N shares of `total` at currency precision; the last takes the remainder so
// the shares always add back up to the total exactly.
export const evenShares = (total, n, precision) => {
	if (n < 1) return [];
	const share = roundCurrency(total / n, precision);
	return Array.from({ length: n }, (_, i) =>
		i < n - 1 ? share : roundCurrency(total - share * (n - 1), precision),
	);
};

// Several payers' payment rows → one row per mode, as the single invoice's
// `payments` child table expects.
export const mergePayments = (paymentLists) => {
	const byMode = new Map();
	paymentLists.flat().forEach((row) => {
		const amount = flt(row?.amount);
		if (!row?.mode_of_payment || !amount) return;
		byMode.set(row.mode_of_payment, (byMode.get(row.mode_of_payment) ?? 0) + amount);
	});
	return [...byMode.entries()].map(([mode_of_payment, amount]) => ({ mode_of_payment, amount }));
};

// A payer's tendered rows reduced to what they actually owe: any change given
// back comes off their largest non-gateway row (the cash they handed over),
// so the invoice's payments add up to its grand total instead of including
// cash that went straight back out of the drawer.
export const netTurnPayments = (payments, amountDue, gatewayModes, precision) => {
	const rows = payments
		.map((row) => ({ mode_of_payment: row.mode_of_payment, amount: flt(row.amount) }))
		.filter((row) => row.amount > 0);
	const tendered = rows.reduce((sum, row) => sum + row.amount, 0);
	let change = roundCurrency(tendered - amountDue, precision);
	if (change <= 0) return rows;
	const order = rows
		.map((row, index) => ({ row, index }))
		.filter(({ row }) => !gatewayModes.includes(row.mode_of_payment))
		.sort((a, b) => b.row.amount - a.row.amount);
	const net = rows.map((row) => ({ ...row }));
	for (const { index } of order) {
		if (change <= 0) break;
		const take = Math.min(change, net[index].amount);
		net[index].amount = roundCurrency(net[index].amount - take, precision);
		change = roundCurrency(change - take, precision);
	}
	return net.filter((row) => row.amount > 0);
};

// Per-payer breakdown for an even/custom split's single invoice, saved to its
// `remarks` (the invoice's payments rows are merged per mode, so this is the
// only record of who paid what).
export const describeTurns = (turns, totalTurns, formatAmount) =>
	`Split ${totalTurns} ways: ` +
	turns
		.map(
			(turn, i) =>
				`Payer ${i + 1} ${formatAmount(turn.amount)} (` +
				(turn.payments ?? []).map((row) => `${row.mode_of_payment} ${formatAmount(row.amount)}`).join(", ") +
				")",
		)
		.join("; ");
