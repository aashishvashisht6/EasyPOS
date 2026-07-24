import { useState, useMemo } from "react";
import "./style.css";
import { postDraftInvoice, fetchInvoice } from "../../api/Invoice";
import usePOSSessionStore from "../../store/posSessionStore";
import useCartStore from "../../store/cartStore";
import InvoicePay from "../InvoicePay";
import NewCustomerModal from "../Customer/NewCustomerModal";
import DraftPickerModal from "./DraftPickerModal";
import { LinkField, TextField, SelectField, NumberField, AlertModal } from "../common";
import { roundCurrency } from "../../utils/number";
import { computeCartTotals } from "../../utils/tax";

const Cart = () => {
  const openingDetail = usePOSSessionStore((s) => s.openingDetail);
  const hasOpeningEntry = usePOSSessionStore((s) => s.hasOpeningEntry);
  const openOpeningModal = usePOSSessionStore((s) => s.openOpeningModal);
  const currencySymbol = usePOSSessionStore((s) => s.currencySymbol);
  const currencyPrecision = usePOSSessionStore((s) => s.currencyPrecision);
  const floatPrecision = usePOSSessionStore((s) => s.floatPrecision);
  const taxTemplateRows = usePOSSessionStore((s) => s.taxTemplateRows);

  const customer = useCartStore((s) => s.customer);
  const cartItems = useCartStore((s) => s.items);
  const salesInvoiceName = useCartStore((s) => s.salesInvoiceName);
  const setCustomer = useCartStore((s) => s.setCustomer);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearItems = useCartStore((s) => s.clearItems);
  const setSalesInvoiceName = useCartStore((s) => s.setSalesInvoiceName);
  const loadDraft = useCartStore((s) => s.loadDraft);
  const updateItemField = useCartStore((s) => s.updateItemField);
  const updateItemQty = useCartStore((s) => s.updateItemQty);
  const discountOn = useCartStore((s) => s.discountOn);
  const setDiscountOn = useCartStore((s) => s.setDiscountOn);
  const discount = useCartStore((s) => s.discountPercentage);
  const setDiscount = useCartStore((s) => s.setDiscountPercentage);

  const [customerLabel, setCustomerLabel] = useState("");
  const [saveDraft, setSaveDraft] = useState(false);
  const [payInvoice, setPayInvoice] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [showDraftPicker, setShowDraftPicker] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [validationError, setValidationError] = useState("");

  const itemTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + (item.amount ?? 0), 0),
    [cartItems]
  );

  // Item-level discounts are independent of the order-level discount below —
  // each item carries its own discount_amount (auto-applied, e.g. via pricing rules).
  const itemDiscountTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + (item.discount_amount ?? 0), 0),
    [cartItems]
  );

  const netAfterItemDiscount = useMemo(
    () => roundCurrency(itemTotal - itemDiscountTotal, currencyPrecision),
    [itemTotal, itemDiscountTotal, currencyPrecision]
  );

  // Order-level tax rows previewed from the POS Profile's taxes_and_charges
  // template, plus the additional order discount's effect on them — mirrors
  // erpnext.controllers.taxes_and_totals (calculate_taxes + apply_discount_amount):
  // the discount is distributed pro-rata across items and tax is recomputed
  // on the reduced total, not just subtracted from the post-tax grand total.
  // Item-wise rate overrides come from each cart item's item_tax_rate (see
  // easy_pos.api.item._get_item_tax_map).
  const { taxRows, totalTax: totalTaxAmount, discountAmount, grandTotal } = useMemo(
    () =>
      computeCartTotals({
        items: cartItems,
        taxTemplateRows,
        netTotal: netAfterItemDiscount,
        discountOn,
        discountPercentage: discount,
        precision: currencyPrecision,
      }),
    [cartItems, taxTemplateRows, netAfterItemDiscount, discountOn, discount, currencyPrecision]
  );

  const formatAmount = (value) =>
    `${currencySymbol}${(value ?? 0).toLocaleString("en-IN", {
      minimumFractionDigits: currencyPrecision,
      maximumFractionDigits: currencyPrecision,
    })}`;

  const clearCart = () => {
    clearItems();
    setExpandedIndex(null);
  };

  const handleRemoveItem = (index) => {
    removeItem(index);
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const createDraftInvoice = () => {
    if (!hasOpeningEntry) {
      openOpeningModal();
      return;
    }
    if (!customer) {
      setValidationError("Please select a customer");
      return;
    }
    if (cartItems.length < 1) {
      setValidationError("Please add at least one item to the cart");
      return;
    }
    setSaveDraft(true);
    const items = cartItems.map(
      ({ item_code, qty, rate, amount, serial_no, batch_no, discount_amount, item_tax_template }) => ({
        item_code, qty, rate, amount, serial_no, batch_no, discount_amount, item_tax_template,
      }),
    );
    postDraftInvoice(
      {
        customer,
        items,
        payments: [],
        sales_invoice: salesInvoiceName,
        apply_discount_on: discountOn || undefined,
        additional_discount_percentage: roundCurrency(parseFloat(discount) || 0, floatPrecision),
        taxes: taxRows,
      },
      openingDetail,
      0,
    ).then((data) => {
      if (data?.name) {
        setSaveDraft(false);
        setSalesInvoiceName(data.name);
      } else {
        setValidationError("Failed to save draft");
        setSaveDraft(false);
      }
    });
  };

  const selectDraft = (draftName) => {
    fetchInvoice(draftName).then((doc) => {
      if (!doc) return;
      loadDraft({
        name: doc.name,
        customer: doc.customer,
        items: (doc.items ?? []).map((item) => ({
          item_code: item.item_code,
          qty: item.qty,
          rate: item.rate,
          amount: item.amount,
          discount_amount: item.discount_amount ?? 0,
          serial_no: item.serial_no ?? "",
          batch_no: item.batch_no ?? "",
          has_serial_no: !!item.serial_no,
          has_batch_no: !!item.batch_no,
          item_tax_template: item.item_tax_template ?? "",
          item_tax_rate: item.item_tax_rate ? JSON.parse(item.item_tax_rate) : {},
        })),
        payments: (doc.payments ?? []).map((p) => ({
          mode_of_payment: p.mode_of_payment,
          amount: p.amount,
        })),
        discountOn: doc.apply_discount_on || "",
        discountPercentage: doc.additional_discount_percentage || "",
      });
      setCustomerLabel(doc.customer_name || doc.customer || "");
      setShowDraftPicker(false);
    });
  };

  return (
    <div className="cart-section">
      <div className="cart-section-card">

        {/* ── Header ── */}
        <div className="cart-header-bar d-flex align-items-center justify-content-between py-2 px-3">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-cart3" style={{ fontSize: 15, color: "var(--color-text-secondary)" }} />
            <h5 className="mb-0" style={{ fontFamily: "var(--font-heading)", fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
              Shopping Cart
            </h5>
          </div>
          <span className="pos-badge pos-badge-success">{cartItems.length} item{cartItems.length === 1 ? "" : "s"}</span>
        </div>

        <div className="card-body p-0 d-flex flex-column" style={{ minHeight: 0, flex: 1 }}>

          {/* ── Customer ── */}
          <div className="px-3 pt-3 pb-2 border-bottom">
            <LinkField
              label="Customer"
              doctype="Customer"
              value={customer}
              displayValue={customer ? customerLabel : ""}
              placeholder="Search customer..."
              actionIcon="bi-person-plus"
              actionTitle="New customer"
              onAction={() => setShowNewCustomer(true)}
              onChange={(value, option) => {
                setCustomer(value ?? "");
                setCustomerLabel(option?.description || option?.value || "");
              }}
              renderOption={(option) => (
                <div className="d-flex align-items-center gap-2">
                  <div className="pos-avatar" style={{ width: 28, height: 28 }}>
                    {(option.description || option.value)?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="pos-link-option-label">{option.description || option.value}</div>
                    {option.description && (
                      <div className="pos-link-option-desc">{option.value}</div>
                    )}
                  </div>
                </div>
              )}
            />
          </div>

          {/* ── Cart Items ── */}
          <div className="d-flex flex-column" style={{ flex: 1, minHeight: 0 }}>

            {/* Toolbar */}
            <div className="d-flex align-items-center justify-content-between px-3 pt-2 pb-1">
              <p className="cart-section-label mb-0">Cart Items</p>
              {cartItems.length > 0 && (
                <button className="cart-clear-btn" onClick={clearCart}>
                  <i className="bi bi-trash3" />
                  Clear all
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-auto" style={{ flex: 1, minHeight: 0 }}>
              {cartItems.length === 0 ? (
                <div className="d-flex flex-column align-items-center justify-content-center text-muted gap-2 py-5">
                  <i className="bi bi-cart-x" style={{ fontSize: 28, opacity: 0.3 }} />
                  <span style={{ fontSize: 13 }}>No items in cart</span>
                  <span style={{ fontSize: 11.5, color: "var(--color-text-faint)" }}>Tap an item to add it here</span>
                </div>
              ) : (
                <div className="cart-lines">
                  {cartItems.map((item, index) => {
                    const expanded = expandedIndex === index;
                    return (
                      <div key={`item-${index}`} className={`cart-line-wrap ${expanded ? "expanded" : ""}`}>
                        <div
                          className="cart-line"
                          onClick={() => setExpandedIndex(expanded ? null : index)}
                        >
                          <div className="cart-line-icon">
                            <i className="bi bi-box-seam" />
                          </div>

                          <div className="cart-line-info">
                            <div className="cart-line-name" title={item.item_code}>
                              {item.item_code}
                            </div>
                            <div className="cart-line-meta">
                              {formatAmount(item.rate)} each
                              <i className={`bi bi-chevron-${expanded ? "up" : "down"}`} />
                            </div>
                          </div>

                          <div className="cart-line-qty" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              disabled={item.qty <= 1}
                              onClick={() => updateItemQty(index, item.qty - 1, currencyPrecision)}
                            >
                              −
                            </button>
                            <span>{item.qty}</span>
                            <button type="button" onClick={() => updateItemQty(index, item.qty + 1, currencyPrecision)}>
                              +
                            </button>
                          </div>

                          <div className="cart-line-amount">{formatAmount(item.amount)}</div>

                          <button
                            type="button"
                            className="cart-line-remove"
                            title="Remove"
                            onClick={(e) => { e.stopPropagation(); handleRemoveItem(index); }}
                          >
                            <i className="bi bi-x-lg" />
                          </button>
                        </div>

                        {expanded && (
                          <div className="cart-line-detail">
                            <div>
                              <div className="cart-detail-label">Discount</div>
                              <div className="cart-detail-value" style={{ fontFamily: "var(--font-mono)" }}>
                                {item.discount_amount > 0 ? `– ${formatAmount(item.discount_amount)}` : formatAmount(0)}
                              </div>
                            </div>

                            {item.has_serial_no && (
                              <div style={{ minWidth: 130, flex: 1 }}>
                                <div className="cart-detail-label">Serial No</div>
                                <TextField
                                  size="sm"
                                  className="cart-detail-input"
                                  placeholder="Enter serial no"
                                  value={item.serial_no ?? ""}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(value) => updateItemField(index, "serial_no", value)}
                                />
                              </div>
                            )}

                            {item.has_batch_no && (
                              <div style={{ minWidth: 130, flex: 1 }}>
                                <div className="cart-detail-label">Batch No</div>
                                <TextField
                                  size="sm"
                                  className="cart-detail-input"
                                  placeholder="Enter batch no"
                                  value={item.batch_no ?? ""}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(value) => updateItemField(index, "batch_no", value)}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Discount ── */}
          <div className="px-3 pt-2 pb-2 border-top">
            <p className="cart-section-label mb-2">Order Discount</p>
            <div className="d-flex gap-2 cart-discount-row">
              <div style={{ flex: 1.4 }}>
                <SelectField
                  size="sm"
                  className="cart-discount-select"
                  placeholder="Apply on…"
                  value={discountOn}
                  onChange={setDiscountOn}
                  options={[
                    { label: "Grand Total", value: "Grand Total" },
                    { label: "Net Total", value: "Net Total" },
                  ]}
                />
              </div>
              <div style={{ flex: 1 }}>
                <NumberField
                  size="sm"
                  className="cart-discount-input"
                  placeholder="0"
                  min={0}
                  max={100}
                  suffix="%"
                  value={discount}
                  onChange={(value) => setDiscount(value === "" ? "" : Math.min(value, 100))}
                />
              </div>
            </div>
          </div>

          {/* ── Totals ── */}
          <div className="cart-totals px-3 py-2">
            <div className="d-flex justify-content-between mb-1">
              <span className="cart-total-label">Item Total</span>
              <span className="cart-total-value">{formatAmount(itemTotal)}</span>
            </div>
            <div className="d-flex justify-content-between mb-1">
              <span className="cart-total-label">Taxes</span>
              <span className="cart-total-value">{formatAmount(totalTaxAmount)}</span>
            </div>

            {taxRows.map((row) => (
              <div className="d-flex justify-content-between mb-1" key={row.account_head}>
                <span className="cart-total-label" style={{ paddingLeft: 10, fontSize: 11.5 }}>
                  {row.description || row.account_head} {row.rate ? `(${row.rate}%)` : ""}
                </span>
                <span className="cart-total-value" style={{ fontSize: 11.5 }}>
                  {formatAmount(row.tax_amount)}
                </span>
              </div>
            ))}

            {itemDiscountTotal > 0 && (
              <div className="d-flex justify-content-between mb-1">
                <span className="cart-total-label" style={{ color: "var(--color-success-text)" }}>Item Discounts</span>
                <span className="cart-total-value" style={{ color: "var(--color-success-text)" }}>
                  – {formatAmount(itemDiscountTotal)}
                </span>
              </div>
            )}

            {discountAmount > 0 && (
              <div className="d-flex justify-content-between mb-1">
                <span className="cart-total-label" style={{ color: "var(--color-success-text)" }}>
                  Order Discount ({discount}%)
                </span>
                <span className="cart-total-value" style={{ color: "var(--color-success-text)" }}>
                  – {formatAmount(discountAmount)}
                </span>
              </div>
            )}

            <div className="cart-grand-total d-flex justify-content-between align-items-center">
              <span>Grand Total</span>
              <span>{formatAmount(grandTotal)}</span>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="px-3 pb-3 pt-1 position-relative">
            <div className="row g-2 mb-2">
              <div className="col-6">
                <button
                  className="pos-btn pos-btn-secondary w-100"
                  style={{ height: 36, fontSize: 12.5 }}
                  onClick={createDraftInvoice}
                  disabled={saveDraft}
                >
                  {saveDraft ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <i className="bi bi-save2 me-1" />
                      Save Draft
                    </>
                  )}
                </button>
              </div>
              <div className="col-6">
                <button
                  className="pos-btn pos-btn-secondary w-100"
                  style={{ height: 36, fontSize: 12.5 }}
                  onClick={() => setShowDraftPicker(true)}
                >
                  <i className="bi bi-folder2-open me-1" />
                  Load Draft
                </button>
              </div>
            </div>

            <button
              className="pos-btn pos-btn-primary w-100"
              style={{ height: 44, fontSize: 14 }}
              onClick={() => {
                if (!hasOpeningEntry) {
                  openOpeningModal();
                  return;
                }
                setPayInvoice(true);
              }}
              disabled={cartItems.length === 0 || !customer}
            >
              <i className="bi bi-credit-card me-1" />
              Pay {formatAmount(grandTotal)}
            </button>
          </div>

        </div>{/* end card-body */}
      </div>{/* end card */}

      {payInvoice && (
        <InvoicePay
          onClose={() => setPayInvoice(false)}
          grandTotal={grandTotal}
          taxes={taxRows}
        />
      )}

      {showDraftPicker && (
        <DraftPickerModal onClose={() => setShowDraftPicker(false)} onSelect={selectDraft} />
      )}

      {showNewCustomer && (
        <NewCustomerModal
          onClose={() => setShowNewCustomer(false)}
          onCreated={(doc) => {
            setCustomer(doc.name);
            setCustomerLabel(doc.customer_name || doc.name);
            setShowNewCustomer(false);
          }}
        />
      )}

      <AlertModal
        open={!!validationError}
        onClose={() => setValidationError("")}
        message={validationError}
      />
    </div>
  );
};

export default Cart;
