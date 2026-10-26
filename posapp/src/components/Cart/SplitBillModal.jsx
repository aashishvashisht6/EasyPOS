import { useMemo, useState } from "react";
import InvoicePay from "../InvoicePay";
import { Modal, ConfirmModal, FilterChips, NumberField, CurrencyField, LinkField, ErrorAlert } from "../common";
import useCartStore from "../../store/cartStore";
import usePOSSessionStore from "../../store/posSessionStore";
import { roundCurrency } from "../../utils/number";
import {
  SPLIT_MODES,
  assignedQty,
  computeBillBreakdown,
  describeTurns,
  evenShares,
  isLineQtySplittable,
  mergePayments,
  unbalancedLines,
} from "../../utils/splitBill";

const MODE_OPTIONS = [
  { label: "By Item", value: SPLIT_MODES.ITEM },
  { label: "Evenly", value: SPLIT_MODES.EVEN },
  { label: "Custom Amount", value: SPLIT_MODES.CUSTOM },
];

const MAX_PAYERS = 20;

// Split Bill controller (UPCOMING_FEATURES.md #4, docs/SPLIT_BILL_PLAN.md).
// Works off cartStore's frozen `split` slice:
//   - By item: each bill is its own Sales Invoice, paid through InvoicePay's
//     `bill` mode with just that bill's lines, all tagged with one
//     ep_split_group.
//   - Evenly / custom amount: one Sales Invoice, paid down one payer at a
//     time — every turn but the last saves it as a Draft with the payments so
//     far, the last submits it.
// Closing this modal (✕) only hides it; the split stays in progress and the
// cart shows a banner to resume or cancel it.
const SplitBillModal = ({ onClose, customerDisplay }) => {
  const split = useCartStore((s) => s.split);
  const updateSplit = useCartStore((s) => s.updateSplit);
  const cancelSplit = useCartStore((s) => s.cancelSplit);
  const resetCart = useCartStore((s) => s.resetCart);
  const currencySymbol = usePOSSessionStore((s) => s.currencySymbol);
  const currencyPrecision = usePOSSessionStore((s) => s.currencyPrecision);
  const taxTemplateRows = usePOSSessionStore((s) => s.taxTemplateRows);
  const customerGroups = usePOSSessionStore((s) => s.customerGroups);

  const [paying, setPaying] = useState(null);
  const [splitLineIndex, setSplitLineIndex] = useState(null);
  const [customAmount, setCustomAmount] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState("");

  const formatAmount = (value) =>
    `${currencySymbol}${(value ?? 0).toLocaleString("en-IN", {
      minimumFractionDigits: currencyPrecision,
      maximumFractionDigits: currencyPrecision,
    })}`;

  const breakdown = useMemo(
    () =>
      split
        ? computeBillBreakdown({
            snapshot: split.snapshot,
            bills: split.bills,
            assignments: split.assignments,
            freeAssignments: split.freeAssignments,
            taxTemplateRows,
            precision: currencyPrecision,
          })
        : [],
    [split, taxTemplateRows, currencyPrecision],
  );

  if (!split) return null;

  const { snapshot, bills, assignments, freeAssignments, mode, turns } = split;
  const paidBills = bills.filter((bill) => bill.status === "paid");
  const paidTurnsTotal = roundCurrency(turns.reduce((sum, turn) => sum + turn.amount, 0), currencyPrecision);
  const anythingPaid = paidBills.length > 0 || turns.length > 0;
  const remaining = roundCurrency(snapshot.grandTotal - paidTurnsTotal, currencyPrecision);
  const unbalanced = unbalancedLines(snapshot.items, assignments);
  const billById = Object.fromEntries(bills.map((bill) => [bill.id, bill]));
  const isLineLocked = (index) =>
    Object.entries(assignments[index] ?? {}).some(
      ([billId, qty]) => qty > 0 && billById[billId]?.status === "paid",
    );
  const openBills = bills.filter((bill) => bill.status === "open");

  // ── By item: assignment ──────────────────────────────────────────────

  const assignWholeLine = (index, billId) =>
    updateSplit((s) => ({
      assignments: { ...s.assignments, [index]: { [billId]: s.snapshot.items[index].qty } },
    }));

  const setLineQtyForBill = (index, billId, qty) =>
    updateSplit((s) => ({
      assignments: {
        ...s.assignments,
        [index]: { ...s.assignments[index], [billId]: Math.max(0, Math.floor(Number(qty) || 0)) },
      },
    }));

  const assignFreeLine = (index, billId) =>
    updateSplit((s) => ({ freeAssignments: { ...s.freeAssignments, [index]: billId } }));

  const addBill = () =>
    updateSplit((s) => {
      const id = Math.max(...s.bills.map((bill) => bill.id)) + 1;
      return {
        bills: [
          ...s.bills,
          { id, customer: s.snapshot.customer, customerName: s.snapshot.customerName, status: "open", invoiceName: "" },
        ],
      };
    });

  // A removed bill's lines (and free lines) fold back into the first open bill.
  const removeBill = (billId) =>
    updateSplit((s) => {
      const target = s.bills.find((bill) => bill.status === "open" && bill.id !== billId).id;
      const nextAssignments = Object.fromEntries(
        Object.entries(s.assignments).map(([index, assignment]) => {
          const { [billId]: moved = 0, ...rest } = assignment;
          return [index, moved ? { ...rest, [target]: (rest[target] || 0) + moved } : rest];
        }),
      );
      const nextFree = Object.fromEntries(
        Object.entries(s.freeAssignments).map(([index, id]) => [index, id === billId ? target : id]),
      );
      return {
        bills: s.bills.filter((bill) => bill.id !== billId),
        assignments: nextAssignments,
        freeAssignments: nextFree,
      };
    });

  const setBillCustomer = (billId, customer, customerName) =>
    updateSplit((s) => ({
      bills: s.bills.map((bill) => (bill.id === billId ? { ...bill, customer, customerName } : bill)),
    }));

  // ── Paying ───────────────────────────────────────────────────────────

  const startPaying = (config) => {
    setError("");
    customerDisplay.sendPaymentStatus({
      status: "processing",
      grandTotal: config.amount,
      splitLabel: config.bill.label,
    });
    setPaying(config);
  };

  // The cart's own saved Draft (if it was loaded from one) is taken over by
  // the first paid bill for the same customer — _save_sales_invoice's update
  // path keeps a Draft's original customer, so another customer's bill can't.
  const draftAvailable = !split.draftConsumed && (snapshot.salesInvoiceName || snapshot.pendingOfflineId);
  const draftStranded =
    draftAvailable && !openBills.some((bill) => bill.customer === snapshot.customer);

  const payBill = (entry, position) => {
    if (unbalanced.length) {
      setError("Every line's quantity must be fully assigned across the bills before paying.");
      return;
    }
    const emptyBill = breakdown.find((other) => other.bill.status === "open" && !other.items.length);
    if (emptyBill) {
      setError(`Bill ${bills.indexOf(emptyBill.bill) + 1} has no items — assign some or remove it.`);
      return;
    }
    if (!entry.bill.customer) {
      setError("Pick a customer for this bill.");
      return;
    }
    const sameCustomer = entry.bill.customer === snapshot.customer;
    const takesDraft = draftAvailable && sameCustomer;
    startPaying({
      kind: "bill",
      billId: entry.bill.id,
      takesDraft,
      couponSent: !split.couponUsed && !!snapshot.couponCode,
      amount: entry.grandTotal,
      grandTotal: entry.grandTotal,
      taxes: entry.taxes,
      bill: {
        label: `Bill ${position} of ${bills.length}`,
        customer: entry.bill.customer,
        customerName: entry.bill.customerName,
        items: entry.items,
        freeItems: entry.freeItems,
        discountOn: snapshot.discountOn,
        discountPercentage: snapshot.discountPercentage,
        couponCode: split.couponUsed ? "" : snapshot.couponCode,
        salesInvoiceName: takesDraft ? snapshot.salesInvoiceName : "",
        pendingOfflineId: takesDraft ? snapshot.pendingOfflineId : "",
        splitGroup: split.group,
        splitIndex: `${position}/${bills.length}`,
        allowLoyalty: sameCustomer,
        keepLoyaltyProgram: sameCustomer,
      },
    });
  };

  const evenAmounts = evenShares(snapshot.grandTotal, split.payerCount, currencyPrecision);

  const payTurn = () => {
    const turnIndex = turns.length;
    let amount;
    let finalTurn;
    if (mode === SPLIT_MODES.EVEN) {
      amount = evenAmounts[turnIndex];
      finalTurn = turnIndex === split.payerCount - 1;
    } else {
      amount = roundCurrency(parseFloat(customAmount) || 0, currencyPrecision);
      if (amount <= 0 || amount > remaining) {
        setError(`Enter an amount between ${formatAmount(0)} and ${formatAmount(remaining)}.`);
        return;
      }
      finalTurn = roundCurrency(remaining - amount, currencyPrecision) <= 0;
    }
    const totalTurns = mode === SPLIT_MODES.EVEN ? split.payerCount : turnIndex + 1;
    const label =
      mode === SPLIT_MODES.EVEN ? `Payer ${turnIndex + 1} of ${split.payerCount}` : `Payer ${turnIndex + 1}`;
    startPaying({
      kind: "turn",
      amount,
      finalTurn,
      label,
      grandTotal: snapshot.grandTotal,
      taxes: snapshot.taxes,
      bill: {
        label,
        turn: true,
        amountDue: amount,
        finalTurn,
        priorPayments: mergePayments(turns.map((turn) => turn.payments)),
        buildRemarks: (turnPayments) =>
          describeTurns(
            [...turns, { amount, payments: turnPayments }],
            mode === SPLIT_MODES.EVEN ? split.payerCount : finalTurn ? totalTurns : `${totalTurns}+`,
            formatAmount,
          ),
        customer: snapshot.customer,
        customerName: snapshot.customerName,
        items: snapshot.items,
        freeItems: snapshot.freeItems,
        discountOn: snapshot.discountOn,
        discountPercentage: snapshot.discountPercentage,
        couponCode: snapshot.couponCode,
        salesInvoiceName: split.draftName || snapshot.salesInvoiceName,
        pendingOfflineId: split.draftOfflineId || snapshot.pendingOfflineId,
        allowLoyalty: true,
        keepLoyaltyProgram: true,
      },
    });
  };

  // Called by InvoicePay once one bill/turn is paid (or saved, for an interim turn).
  const handlePaid = (result) => {
    const config = paying;
    if (config.kind === "bill") {
      const nextBills = bills.map((bill) =>
        bill.id === config.billId ? { ...bill, status: "paid", invoiceName: result.invoiceName } : bill,
      );
      const allPaid = nextBills.every((bill) => bill.status === "paid");
      if (allPaid) {
        // The thank-you screen shows the bill/share that was just paid —
        // amountPaid/changeDue are that payer's, not the whole cart's.
        customerDisplay.sendInvoiceComplete({
          invoiceName: result.invoiceName,
          grandTotal: config.amount,
          amountPaid: result.amountPaid,
          changeDue: result.changeDue,
        });
        resetCart();
        onClose();
        return;
      }
      updateSplit({
        bills: nextBills,
        draftConsumed: split.draftConsumed || config.takesDraft,
        couponUsed: split.couponUsed || config.couponSent,
      });
      customerDisplay.sendSplitPartComplete({ splitLabel: config.bill.label, amountPaid: config.amount });
      return;
    }

    if (config.finalTurn) {
      customerDisplay.sendInvoiceComplete({
        invoiceName: result.invoiceName,
        grandTotal: config.amount,
        amountPaid: result.amountPaid,
        changeDue: result.changeDue,
      });
      resetCart();
      onClose();
      return;
    }
    updateSplit((s) => ({
      turns: [...s.turns, { amount: config.amount, payments: result.turnPayments, invoiceName: result.invoiceName }],
      draftName: result.invoiceName,
      draftOfflineId: result.offlineId || s.draftOfflineId,
    }));
    setCustomAmount("");
    customerDisplay.sendSplitPartComplete({ splitLabel: config.label, amountPaid: config.amount });
  };

  if (paying) {
    return (
      <InvoicePay
        bill={paying.bill}
        grandTotal={paying.grandTotal}
        taxes={paying.taxes}
        onComplete={handlePaid}
        onClose={() => setPaying(null)}
      />
    );
  }

  // ── Rendering ────────────────────────────────────────────────────────

  const renderBillChips = (index, item) => {
    const locked = isLineLocked(index);
    const assignment = assignments[index] ?? {};
    const splittable = isLineQtySplittable(item);
    const qtySplitOpen = splitLineIndex === index;
    const wholeBillId = Object.keys(assignment).length === 1 && assignedQty(assignment) === item.qty
      ? Number(Object.keys(assignment)[0])
      : null;
    return (
      <div className="split-line-assign">
        <div className="d-flex flex-wrap gap-1 align-items-center">
          {bills.map((bill, position) => {
            const qty = assignment[bill.id] || 0;
            return (
              <button
                key={bill.id}
                type="button"
                className={`split-bill-chip${qty ? " active" : ""}`}
                disabled={locked || bill.status === "paid"}
                title={`Bill ${position + 1}`}
                onClick={() => assignWholeLine(index, bill.id)}
              >
                {position + 1}
                {qty > 0 && wholeBillId === null && <span className="split-bill-chip-qty">×{qty}</span>}
              </button>
            );
          })}
          {splittable && !locked && (
            <button
              type="button"
              className="btn btn-link btn-sm p-0 ms-1"
              style={{ fontSize: 11.5, textDecoration: "none" }}
              onClick={() => setSplitLineIndex(qtySplitOpen ? null : index)}
            >
              <i className="bi bi-distribute-horizontal me-1" />
              {qtySplitOpen ? "Done" : "Split qty"}
            </button>
          )}
        </div>
        {qtySplitOpen && (
          <div className="split-qty-grid pos-inline-fields mt-2">
            {bills.map((bill, position) => (
              <div key={bill.id} className="split-qty-cell">
                <span className="split-qty-label">Bill {position + 1}</span>
                <NumberField
                  size="sm"
                  min={0}
                  max={item.qty}
                  disabled={bill.status === "paid"}
                  value={assignment[bill.id] || 0}
                  onChange={(value) => setLineQtyForBill(index, bill.id, value === "" ? 0 : value)}
                />
              </div>
            ))}
          </div>
        )}
        {unbalanced.includes(index) && (
          <div className="split-line-warning">
            {assignedQty(assignment)} of {item.qty} assigned
          </div>
        )}
      </div>
    );
  };

  const byItemContent = (
    <>
      <div className="split-lines">
        {snapshot.items.map((item, index) => (
          <div key={`line-${index}`} className="split-line">
            <div className="split-line-info">
              <div className="split-line-name" title={item.item_code}>
                {item.item_code}
                {item.has_serial_no && item.serial_no && (
                  <span className="split-line-tag">{item.serial_no}</span>
                )}
              </div>
              <div className="split-line-meta">
                {item.qty} × {formatAmount(item.rate)}
              </div>
            </div>
            {renderBillChips(index, item)}
          </div>
        ))}
        {(snapshot.freeItems ?? []).map((item, index) => (
          <div key={`free-${index}`} className="split-line">
            <div className="split-line-info">
              <div className="split-line-name">
                <i className="bi bi-gift-fill me-1" style={{ color: "var(--color-success-text)" }} />
                {item.item_code}
              </div>
              <div className="split-line-meta">{item.qty} × FREE</div>
            </div>
            <div className="split-line-assign">
              <div className="d-flex flex-wrap gap-1">
                {bills.map((bill, position) => (
                  <button
                    key={bill.id}
                    type="button"
                    className={`split-bill-chip${freeAssignments[index] === bill.id ? " active" : ""}`}
                    disabled={billById[freeAssignments[index]]?.status === "paid" || bill.status === "paid"}
                    onClick={() => assignFreeLine(index, bill.id)}
                  >
                    {position + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="d-flex align-items-center justify-content-between mt-3 mb-2">
        <span className="pos-field-label mb-0">Bills</span>
        <button type="button" className="pos-btn pos-btn-secondary" onClick={addBill}>
          <i className="bi bi-plus-lg" /> Add Bill
        </button>
      </div>

      {draftStranded && (
        <div className="split-note mb-2">
          <i className="bi bi-exclamation-triangle me-1" />
          This cart was loaded from Draft {snapshot.salesInvoiceName}. Only a bill for{" "}
          {snapshot.customerName || snapshot.customer} can take it over — otherwise that Draft stays in Load Draft.
        </div>
      )}

      <div className="split-bills">
        {breakdown.map((entry, position) => {
          const { bill } = entry;
          const paid = bill.status === "paid";
          return (
            <div key={bill.id} className={`split-bill-card${paid ? " paid" : ""}`}>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="split-bill-title">Bill {position + 1}</span>
                {paid ? (
                  <span className="pos-badge pos-badge-success">
                    <i className="bi bi-check-lg me-1" />
                    Paid
                  </span>
                ) : (
                  bills.length > 2 && (
                    <button
                      type="button"
                      className="cart-clear-btn"
                      title="Remove bill"
                      onClick={() => removeBill(bill.id)}
                    >
                      <i className="bi bi-x-lg" />
                    </button>
                  )
                )}
              </div>
              {paid ? (
                <div className="split-bill-meta">
                  {bill.customerName || bill.customer}
                  <div style={{ fontFamily: "var(--font-mono)" }}>{bill.invoiceName}</div>
                </div>
              ) : (
                <LinkField
                  doctype="Customer"
                  size="sm"
                  value={bill.customer}
                  displayValue={bill.customer ? bill.customerName : ""}
                  placeholder="Customer"
                  filters={customerGroups.length ? { customer_group: ["in", customerGroups] } : undefined}
                  onChange={(value, option) =>
                    setBillCustomer(bill.id, value ?? "", option?.description || option?.value || "")
                  }
                />
              )}
              <div className="split-bill-figures">
                <div className="d-flex justify-content-between">
                  <span>Items</span>
                  <span>{entry.items.reduce((sum, line) => sum + line.qty, 0)}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>Taxes</span>
                  <span>{formatAmount(entry.totalTax)}</span>
                </div>
                {entry.discountAmount > 0 && (
                  <div className="d-flex justify-content-between" style={{ color: "var(--color-success-text)" }}>
                    <span>Discount</span>
                    <span>– {formatAmount(entry.discountAmount)}</span>
                  </div>
                )}
                <div className="d-flex justify-content-between split-bill-total">
                  <span>Total</span>
                  <span>{formatAmount(entry.grandTotal)}</span>
                </div>
              </div>
              {!paid && (
                <button
                  type="button"
                  className="pos-btn pos-btn-primary w-100 mt-2"
                  disabled={!entry.items.length}
                  onClick={() => payBill(entry, position + 1)}
                >
                  <i className="bi bi-credit-card" /> Pay {formatAmount(entry.grandTotal)}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  const paidTurnsList = turns.length > 0 && (
    <div className="split-turns mb-3">
      {turns.map((turn, i) => (
        <div key={`turn-${i}`} className="split-turn paid">
          <span>
            <i className="bi bi-check-circle-fill me-2" style={{ color: "var(--color-success-icon)" }} />
            Payer {i + 1}
            <span className="split-turn-modes">
              {turn.payments.map((row) => row.mode_of_payment).join(", ")}
            </span>
          </span>
          <span>{formatAmount(turn.amount)}</span>
        </div>
      ))}
    </div>
  );

  const evenContent = (
    <>
      <div className="pos-inline-fields d-flex align-items-center gap-2 mb-3">
        <span className="pos-field-label mb-0">Number of payers</span>
        <div style={{ width: 110 }}>
          <NumberField
            size="sm"
            min={2}
            max={MAX_PAYERS}
            disabled={turns.length > 0}
            value={split.payerCount}
            onChange={(value) =>
              updateSplit({ payerCount: Math.min(MAX_PAYERS, Math.max(2, Math.floor(Number(value) || 2))) })
            }
          />
        </div>
      </div>
      {paidTurnsList}
      <div className="split-turns">
        {evenAmounts.slice(turns.length).map((amount, offset) => {
          const index = turns.length + offset;
          return (
            <div key={`share-${index}`} className="split-turn">
              <span>Payer {index + 1}</span>
              <span className="d-flex align-items-center gap-2">
                {formatAmount(amount)}
                {offset === 0 && (
                  <button type="button" className="pos-btn pos-btn-primary" onClick={payTurn}>
                    <i className="bi bi-credit-card" /> Pay
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );

  const customContent = (
    <>
      {paidTurnsList}
      <div className="split-turn mb-2">
        <span className="pos-field-label mb-0">Remaining</span>
        <span className="split-bill-total">{formatAmount(remaining)}</span>
      </div>
      <div className="pos-inline-fields d-flex align-items-center gap-2">
        <span style={{ whiteSpace: "nowrap", fontSize: 13 }}>Payer {turns.length + 1} pays</span>
        <div style={{ flex: 1 }}>
          <CurrencyField
            placeholder={String(remaining)}
            min={0}
            max={remaining}
            value={customAmount}
            onChange={(value) => setCustomAmount(value === "" ? "" : Math.min(value, remaining))}
          />
        </div>
        <button
          type="button"
          className="pos-btn pos-btn-secondary"
          onClick={() => setCustomAmount(remaining)}
        >
          Rest
        </button>
        <button type="button" className="pos-btn pos-btn-primary" onClick={payTurn} disabled={!customAmount}>
          <i className="bi bi-credit-card" /> Pay
        </button>
      </div>
    </>
  );

  const progressLabel =
    mode === SPLIT_MODES.ITEM
      ? `${paidBills.length} of ${bills.length} bills paid`
      : `${formatAmount(paidTurnsTotal)} of ${formatAmount(snapshot.grandTotal)} paid`;

  return (
    <>
      <Modal
        size="lg"
        title="Split Bill"
        subtitle={`${snapshot.customerName || snapshot.customer} · ${formatAmount(snapshot.grandTotal)} · ${progressLabel}`}
        onClose={onClose}
        footer={
          <>
            <button type="button" className="pos-btn pos-btn-danger me-auto" onClick={() => setConfirmCancel(true)}>
              Cancel Split
            </button>
            <button type="button" className="pos-btn pos-btn-secondary" onClick={onClose}>
              Close
            </button>
          </>
        }
      >
        <ErrorAlert message={error} />
        <div className="mb-3">
          {anythingPaid ? (
            <span className="pos-badge pos-badge-success">
              {MODE_OPTIONS.find((option) => option.value === mode).label}
            </span>
          ) : (
            <FilterChips
              options={MODE_OPTIONS}
              value={mode}
              onChange={(value) => {
                setError("");
                updateSplit({ mode: value });
              }}
            />
          )}
        </div>
        {mode === SPLIT_MODES.ITEM ? byItemContent : mode === SPLIT_MODES.EVEN ? evenContent : customContent}
      </Modal>

      <ConfirmModal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => {
          cancelSplit(currencyPrecision);
          setConfirmCancel(false);
          onClose();
        }}
        title="Cancel split?"
        message={
          !anythingPaid
            ? "The cart goes back to normal, unchanged."
            : mode === SPLIT_MODES.ITEM
            ? "Bills already paid stay paid. Only the unpaid bills' items go back into the cart."
            : "Payments already taken stay on the Draft invoice. The cart keeps them prefilled, so Pay collects only the balance."
        }
        confirmLabel="Cancel Split"
        cancelLabel="Keep Splitting"
        danger
      />
    </>
  );
};

export default SplitBillModal;
