import { tData, useTranslation } from "../../translation";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./style.css";
import { postDraftInvoice, fetchInvoice } from "../../api/Invoice";
import { updateQueuedInvoice } from "../../engine/outbox";
import { fetchProductBundleContents } from "../../api/Items";
import { fetchCartPricing } from "../../api/Pricing";
import { fetchCustomerWithLoyalty } from "../../api/Customer";
import usePOSSessionStore from "../../store/posSessionStore";
import useCartStore from "../../store/cartStore";
import useConnectivityStore from "../../engine/connectivity";
import useEngineSettingsStore from "../../engine/settingsStore";
import { computeCartPricingLocally } from "../../utils/pricingEngine";
import InvoicePay from "../InvoicePay";
import NewCustomerModal from "../Customer/NewCustomerModal";
import DraftPickerModal from "./DraftPickerModal";
import { LinkField, TextField, SelectField, NumberField, CurrencyField, AlertModal } from "../common";
import { roundCurrency } from "../../utils/number";
import useCustomerDisplayBroadcaster from "../../hooks/useCustomerDisplayBroadcaster";
import useCurrencyFormatter from "../../hooks/useCurrencyFormatter";
import useCartTotals from "../../hooks/useCartTotals";
import { getServerMessage } from "../../utils/serverError";

const PRICING_DEBOUNCE_MS = 400;

const Cart = ({ onSaleComplete }) => {
  const { __ } = useTranslation();
  const navigate = useNavigate();
  const openingDetail = usePOSSessionStore((s) => s.openingDetail);
  const hasOpeningEntry = usePOSSessionStore((s) => s.hasOpeningEntry);
  const openOpeningModal = usePOSSessionStore((s) => s.openOpeningModal);
  const money = useCurrencyFormatter();
  const currencyPrecision = usePOSSessionStore((s) => s.currencyPrecision);
  const floatPrecision = usePOSSessionStore((s) => s.floatPrecision);
  const posProfile = usePOSSessionStore((s) => s.posProfile);
  const pricingRules = usePOSSessionStore((s) => s.pricingRules);
  const warehouse = usePOSSessionStore((s) => s.warehouse);
  const allowRateChange = usePOSSessionStore((s) => s.allowRateChange);
  const allowDiscountChange = usePOSSessionStore((s) => s.allowDiscountChange);
  const customerGroups = usePOSSessionStore((s) => s.customerGroups);

  const { sendPaymentStatus, sendInvoiceComplete, customerDisplayEnabled } = useCustomerDisplayBroadcaster();
  const openCustomerDisplay = () => {
    window.open("/posapp/customer-display", "easy_pos_customer_display", "width=900,height=650");
  };

  const customer = useCartStore((s) => s.customer);
  const customerName = useCartStore((s) => s.customerName);
  const cartItems = useCartStore((s) => s.items);
  const freeItems = useCartStore((s) => s.freeItems);
  const salesInvoiceName = useCartStore((s) => s.salesInvoiceName);
  const pendingOfflineId = useCartStore((s) => s.pendingOfflineId);
  const setCustomer = useCartStore((s) => s.setCustomer);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearItems = useCartStore((s) => s.clearItems);
  const setSalesInvoiceName = useCartStore((s) => s.setSalesInvoiceName);
  const setPendingOfflineId = useCartStore((s) => s.setPendingOfflineId);
  const loadDraft = useCartStore((s) => s.loadDraft);
  const updateItemField = useCartStore((s) => s.updateItemField);
  const updateItemQty = useCartStore((s) => s.updateItemQty);
  const discountOn = useCartStore((s) => s.discountOn);
  const setDiscountOn = useCartStore((s) => s.setDiscountOn);
  const discount = useCartStore((s) => s.discountPercentage);
  const setDiscount = useCartStore((s) => s.setDiscountPercentage);
  const couponCode = useCartStore((s) => s.couponCode);
  const setCouponCode = useCartStore((s) => s.setCouponCode);
  const applyPricing = useCartStore((s) => s.applyPricing);
  const loyaltyProgram = useCartStore((s) => s.loyaltyProgram);
  const loyaltyPointsBalance = useCartStore((s) => s.loyaltyPointsBalance);
  const customerGroup = useCartStore((s) => s.customerGroup);
  const territory = useCartStore((s) => s.territory);
  const setCustomerWithLoyalty = useCartStore((s) => s.setCustomerWithLoyalty);

  const [saveDraft, setSaveDraft] = useState(false);
  const [payInvoice, setPayInvoice] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [showDraftPicker, setShowDraftPicker] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [pricingLoading, setPricingLoading] = useState(false);
  // Set when a cart line matches a Product Discount (free item) Pricing Rule
  // that only the server can resolve (see the pricing effect below), and that
  // server round trip isn't reachable — the line(s) involved just keep their
  // plain price_list_rate with no visible explanation otherwise, which reads
  // as a silently-missed discount rather than a known offline limitation.
  const [offlinePricingUnresolved, setOfflinePricingUnresolved] = useState(false);
  const offlineModeEnabled = useEngineSettingsStore((s) => s.offlineModeEnabled);
  const isOnline = useConnectivityStore((s) => s.isOnline);
  // Read-only Product Bundle component preview, fetched lazily per item_code
  // the first time its cart line is expanded (see easy_pos.api.item.get_product_bundle_contents).
  const [bundleContents, setBundleContents] = useState({});

  // POS Profile customer_groups restriction (PP-05) — empty = unrestricted,
  // same convention as item_groups (see easy_pos.api.item._allowed_item_groups).
  const customerFilters = customerGroups.length
    ? { customer_group: ["in", customerGroups] }
    : undefined;

  // Re-resolve Pricing Rule discounts (rate/discount_amount/free items)
  // whenever cart contents, the selected customer, or the coupon code change —
  // covers live threshold re-evaluation (PR-06/07/22) and coupon codes
  // (PR-11). The common case (no coupon typed) is resolved entirely on the
  // client via utils/pricingEngine.js, matching against posSessionStore's
  // once-per-shift pricing-rule snapshot — no round trip, no debounce needed.
  // easy_pos.api.pricing.get_cart_pricing is still called whenever a coupon
  // code is present (coupon usage-count validation has to be server-side), or
  // whenever the local engine flags a Product Discount rule it can't resolve
  // (computeCartPricingLocally returns null in that case).
  const cartKey = cartItems.map((item) => `${item.item_code}:${item.qty}:${item.item_group}`).join("|");
  useEffect(() => {
    if (cartItems.length === 0) {
      // Removing the last line one-by-one (rather than "Clear all") doesn't go
      // through clearItems() — free items from a now-gone rule must still drop.
      if (freeItems.length > 0) applyPricing({ items: [], free_items: [] });
      setOfflinePricingUnresolved(false);
      return;
    }
    if (!posProfile) return;
    setCouponError("");

    const lineItems = cartItems.map(({ item_code, qty, item_group, price_list_rate }) => ({
      item_code,
      qty,
      item_group,
      price_list_rate,
    }));

    if (!couponCode) {
      const localResult = computeCartPricingLocally(
        lineItems,
        pricingRules,
        { customer, customerGroup, territory },
        currencyPrecision,
      );
      if (localResult) {
        setOfflinePricingUnresolved(false);
        applyPricing(localResult, currencyPrecision);
        return;
      }
      // Fall through to the server for the Product Discount case below —
      // offline, that call can't succeed, so warn instead of silently
      // leaving whichever line(s) matched a free-item rule undiscounted.
      if (offlineModeEnabled && !isOnline) {
        setOfflinePricingUnresolved(true);
        return;
      }
    }
    setOfflinePricingUnresolved(false);

    const handle = setTimeout(() => {
      setPricingLoading(true);
      fetchCartPricing(
        cartItems.map(({ item_code, qty }) => ({ item_code, qty })),
        customer,
        posProfile,
        couponCode,
      )
        .then((result) => {
          applyPricing(result, currencyPrecision);
        })
        .catch((err) => {
          if (couponCode) {
            setCouponError(getServerMessage(err) || __("Invalid or expired coupon code"));
          }
        })
        .finally(() => setPricingLoading(false));
    }, PRICING_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, customer, customerGroup, territory, pricingRules, posProfile, couponCode, currencyPrecision, offlineModeEnabled, isOnline]);

  // Customer doc (customer_group/territory, for the pricing engine above) +
  // live Loyalty Program summary — one combined fetch
  // (easy_pos.api.customer.get_customer_with_loyalty) whenever the selected
  // customer changes, whether from picking one in the field above, creating
  // one via NewCustomerModal, or loading a Draft. Both this badge and
  // InvoicePay's redeem UI read the result off the same cartStore fields
  // instead of fetching independently.
  useEffect(() => {
    if (!customer) return;
    fetchCustomerWithLoyalty(customer, openingDetail.company).then((doc) => {
      if (doc) setCustomerWithLoyalty(doc);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, openingDetail.company]);

  const { itemTotal, itemDiscountTotal, taxRows, totalTax: totalTaxAmount, discountAmount, grandTotal } = useCartTotals();

  const formatAmount = (value) => money(value);

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
      setValidationError(__("Please select a customer"));
      return;
    }
    if (cartItems.length < 1) {
      setValidationError(__("Please add at least one item to the cart"));
      return;
    }
    setSaveDraft(true);
    const items = [
      ...cartItems.map(
        ({
          item_code, qty, rate, amount, serial_no, batch_no,
          discount_amount, discount_percentage, price_list_rate, pricing_rules, item_tax_template,
        }) => ({
          item_code, qty, rate, amount, serial_no, batch_no,
          discount_amount, discount_percentage, price_list_rate,
          pricing_rules: pricing_rules?.length ? pricing_rules.join(",") : undefined,
          item_tax_template,
        }),
      ),
      ...freeItems.map(({ item_code, qty, rate, uom, pricing_rules }) => ({
        item_code, qty, rate, amount: 0, is_free_item: 1, uom,
        pricing_rules: pricing_rules || undefined,
      })),
    ];
    const invoicePayload = {
      customer,
      items,
      payments: [],
      sales_invoice: salesInvoiceName,
      apply_discount_on: discountOn || undefined,
      additional_discount_percentage: roundCurrency(parseFloat(discount) || 0, floatPrecision),
      taxes: taxRows,
    };
    // Resuming a not-yet-synced offline draft (see selectDraft) updates that
    // same queued row instead of going through create_invoice again, so
    // re-saving never queues a second, duplicate offline invoice.
    const savePromise = pendingOfflineId
      ? updateQueuedInvoice(pendingOfflineId, {
          invoice: invoicePayload,
          opening_details: openingDetail,
          submit: 0,
          coupon_code: couponCode || undefined,
        }).then((result) => {
          if (result?.synced) {
            setPendingOfflineId("");
            return postDraftInvoice(
              { ...invoicePayload, sales_invoice: result.name },
              openingDetail,
              0,
              couponCode || undefined,
            );
          }
          return result?.data?.message;
        })
      : postDraftInvoice(invoicePayload, openingDetail, 0, couponCode || undefined);

    savePromise.then((data) => {
      if (data?.name) {
        setSaveDraft(false);
        setSalesInvoiceName(data.name);
        // A fresh save while offline (not resumed via the draft picker) still
        // needs pendingOfflineId set from here on — otherwise a second Save
        // Draft/checkout on this same cart would queue a brand new offline
        // invoice instead of updating this one (and would resend the just-
        // assigned display_id back as `sales_invoice`, which the backend
        // can't resolve once pushed — see outbox.js's sanitizeInvoicePayload).
        if (data.__offline) setPendingOfflineId(data.offline_id);
      } else {
        setValidationError(__("Failed to save draft"));
        setSaveDraft(false);
      }
    });
  };

  // A pending (not-yet-synced) offline draft has no real ERPNext doc to fetch —
  // DraftPickerModal passes the full pending_invoices row object for those
  // instead of a name string, so it can be loaded straight from its locally
  // queued payload (see engine/outbox.js).
  const loadDraftFromDoc = (doc, pendingOfflineId = "") => {
    loadDraft(
      {
        name: doc.name,
        customer: doc.customer,
        customer_name: doc.customer_name,
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
      },
      pendingOfflineId,
    );
    setShowDraftPicker(false);
  };

  // A pending (not-yet-synced) offline draft has no real ERPNext doc to fetch —
  // DraftPickerModal passes the full pending_invoices row for those instead of
  // a name string, and it's loaded straight from its locally queued payload
  // (see engine/outbox.js), tagging the cart with pendingOfflineId so the next
  // Save Draft/checkout updates that same row instead of queuing a duplicate.
  const selectDraft = (draft) => {
    if (draft && typeof draft === "object" && draft.__offline) {
      const pending = draft.__pending;
      const invoicePayload = pending.payload?.invoice ?? {};
      loadDraftFromDoc(
        {
          name: draft.name,
          customer: invoicePayload.customer,
          customer_name: invoicePayload.customer,
          items: invoicePayload.items ?? [],
          payments: invoicePayload.payments ?? [],
          apply_discount_on: invoicePayload.apply_discount_on,
          additional_discount_percentage: invoicePayload.additional_discount_percentage,
        },
        pending.offline_id,
      );
      return;
    }
    fetchInvoice(draft).then((doc) => {
      if (!doc) return;
      loadDraftFromDoc(doc);
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
              {__("Shopping Cart")}
            </h5>
          </div>
          <div className="d-flex align-items-center gap-2">
            {customerDisplayEnabled && (
              <button
                type="button"
                className="btn btn-link btn-sm p-0 pos-hide-mobile"
                title={__("Open Customer Display")}
                onClick={openCustomerDisplay}
              >
                <i className="bi bi-easel2" style={{ fontSize: 15 }} />
              </button>
            )}
            <span className="pos-badge pos-badge-success">{cartItems.length === 1 ? __("1 item") : __("{n} items", { n: cartItems.length })}</span>
          </div>
        </div>

        <div className="card-body p-0 d-flex flex-column" style={{ minHeight: 0, flex: 1 }}>

          {/* ── Customer ── */}
          <div className="px-3 pt-3 pb-2 border-bottom">
            <LinkField
              label={__("Customer")}
              doctype="Customer"
              value={customer}
              displayValue={customer ? customerName : ""}
              filters={customerFilters}
              placeholder={__("Search customer...")}
              actionIcon="bi-person-plus"
              actionTitle={__("New customer")}
              onAction={() => setShowNewCustomer(true)}
              onChange={(value, option) => {
                setCustomer(value ?? "", option?.description || option?.value || "");
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
            {customer && loyaltyProgram && (
              <div className="mt-1" style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                <i className="bi bi-award me-1" style={{ color: "var(--color-primary)" }} />
                {loyaltyPointsBalance === 1
                  ? __("1 loyalty point available")
                  : __("{n} loyalty points available", { n: loyaltyPointsBalance })}
              </div>
            )}
            {customer && (
              <button
                type="button"
                className="btn btn-link p-0 mt-1"
                style={{ fontSize: 11, textDecoration: "none", color: "var(--color-primary)" }}
                onClick={() =>
                  navigate(
                    `/posapp/invoices?customer=${encodeURIComponent(customer)}&customerName=${encodeURIComponent(customerName || customer)}`,
                  )
                }
              >
                <i className="bi bi-clock-history me-1" />
                {__("View purchase history")}
              </button>
            )}
          </div>

          {/* ── Cart Items ── */}
          <div className="d-flex flex-column cart-items-section" style={{ flex: 1, minHeight: 0 }}>

            {/* Toolbar */}
            <div className="d-flex align-items-center justify-content-between px-3 pt-2 pb-1">
              <p className="cart-section-label mb-0">{__("Cart Items")}</p>
              {cartItems.length > 0 && (
                <button className="cart-clear-btn" onClick={clearCart}>
                  <i className="bi bi-trash3" />
                  {__("Clear all")}
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-auto cart-lines-scroll" style={{ flex: 1, minHeight: 0 }}>
              {cartItems.length === 0 ? (
                <div className="d-flex flex-column align-items-center justify-content-center text-muted gap-2 py-5">
                  <i className="bi bi-cart-x" style={{ fontSize: 28, opacity: 0.3 }} />
                  <span style={{ fontSize: 13 }}>{__("No items in cart")}</span>
                  <span style={{ fontSize: 11.5, color: "var(--color-text-faint)" }}>{__("Tap an item to add it here")}</span>
                </div>
              ) : (
                <div className="cart-lines">
                  {cartItems.map((item, index) => {
                    const expanded = expandedIndex === index;
                    return (
                      <div key={`item-${index}`} className={`cart-line-wrap ${expanded ? "expanded" : ""}`}>
                        <div
                          className="cart-line"
                          onClick={() => {
                            const next = expanded ? null : index;
                            setExpandedIndex(next);
                            if (
                              next !== null &&
                              item.is_product_bundle &&
                              !bundleContents[item.item_code]
                            ) {
                              fetchProductBundleContents(item.item_code).then((rows) => {
                                setBundleContents((prev) => ({ ...prev, [item.item_code]: rows ?? [] }));
                              });
                            }
                          }}
                        >
                          <div className="cart-line-icon">
                            <i className={`bi ${item.is_product_bundle ? "bi-boxes" : "bi-box-seam"}`} />
                          </div>

                          <div className="cart-line-info">
                            <div className="cart-line-name" dir="auto" title={item.item_code}>
                              {item.item_code}
                            </div>
                            <div className="cart-line-meta">
                              {__("{rate} each", { rate: formatAmount(item.rate) })}
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
                            <button
                              type="button"
                              // One row per scanned serial unit — bumping qty in place
                              // would mean shipping more units under a single serial
                              // no, so adding another means scanning/adding again for a
                              // new row. Batch rows stay editable here — one batch no
                              // can cover any quantity (e.g. 5 litres of milk from the
                              // same batch), so this is how that qty is set.
                              disabled={item.has_serial_no}
                              title={item.has_serial_no ? __("Scan/add the item again to add another unit") : undefined}
                              onClick={() => updateItemQty(index, item.qty + 1, currencyPrecision)}
                            >
                              +
                            </button>
                          </div>

                          <div className="cart-line-amount">{formatAmount(item.amount)}</div>

                          <button
                            type="button"
                            className="cart-line-remove"
                            title={__("Remove")}
                            onClick={(e) => { e.stopPropagation(); handleRemoveItem(index); }}
                          >
                            <i className="bi bi-x-lg" />
                          </button>
                        </div>

                        {expanded && (
                          <div className="cart-line-detail">
                            <div style={{ minWidth: 110 }}>
                              <div className="cart-detail-label">{__("Rate")}</div>
                              {allowRateChange ? (
                                <CurrencyField
                                  size="sm"
                                  className="cart-detail-input"
                                  value={item.rate}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(value) => {
                                    const rate = value === "" ? 0 : value;
                                    updateItemField(index, "rate", rate);
                                    updateItemField(
                                      index,
                                      "amount",
                                      roundCurrency(item.qty * rate, currencyPrecision),
                                    );
                                  }}
                                />
                              ) : (
                                <div className="cart-detail-value" style={{ fontFamily: "var(--font-mono)" }}>
                                  {formatAmount(item.rate)}
                                </div>
                              )}
                            </div>

                            <div>
                              <div className="cart-detail-label">{__("Discount")}</div>
                              <div className="cart-detail-value" style={{ fontFamily: "var(--font-mono)" }}>
                                {item.discount_amount > 0 ? `– ${formatAmount(item.discount_amount)}` : formatAmount(0)}
                                {item.discount_percentage > 0 ? ` (${item.discount_percentage.toFixed(1)}%)` : ""}
                              </div>
                              {item.pricing_rules?.length > 0 && (
                                <div style={{ fontSize: 10.5, color: "var(--color-success-text)" }}>
                                  <i className="bi bi-tag-fill me-1" />
                                  {item.pricing_rules.join(", ")}
                                </div>
                              )}
                            </div>

                            {item.has_serial_no && (
                              <div style={{ minWidth: 130, flex: 1 }}>
                                <div className="cart-detail-label">{__("Serial No")}</div>
                                <LinkField
                                  doctype="Serial No"
                                  size="sm"
                                  className="cart-detail-input"
                                  placeholder={__("Search serial no")}
                                  value={item.serial_no ?? ""}
                                  filters={{
                                    item_code: item.item_code,
                                    status: "Active",
                                    ...(warehouse ? { warehouse: ["=", warehouse] } : {}),
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(value) => updateItemField(index, "serial_no", value ?? "")}
                                />
                              </div>
                            )}

                            {item.has_batch_no && (
                              <div style={{ minWidth: 130, flex: 1 }}>
                                <div className="cart-detail-label">{__("Batch No")}</div>
                                <LinkField
                                  doctype="Batch"
                                  size="sm"
                                  className="cart-detail-input"
                                  placeholder={__("Search batch no")}
                                  value={item.batch_no ?? ""}
                                  filters={{
                                    item: item.item_code,
                                    disabled: 0,
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(value) => updateItemField(index, "batch_no", value ?? "")}
                                />
                              </div>
                            )}

                            {item.is_product_bundle && (
                              <div style={{ minWidth: 200, flex: 1 }}>
                                <div className="cart-detail-label">
                                  <i className="bi bi-boxes me-1" />
                                  {__("Bundle Contents")}
                                </div>
                                {bundleContents[item.item_code] === undefined ? (
                                  <div style={{ fontSize: 11, color: "var(--color-text-faint)" }}>{__("Loading…")}</div>
                                ) : bundleContents[item.item_code].length === 0 ? (
                                  <div style={{ fontSize: 11, color: "var(--color-text-faint)" }}>{__("No components")}</div>
                                ) : (
                                  bundleContents[item.item_code].map((row, i) => (
                                    <div
                                      key={`bundle-${item.item_code}-${i}`}
                                      className="d-flex justify-content-between"
                                      style={{ fontSize: 11.5 }}
                                    >
                                      <span>{tData(row.item_name || row.item_code)}</span>
                                      <span style={{ color: "var(--color-text-faint)" }}>
                                        {row.qty * item.qty} {row.uom}
                                      </span>
                                    </div>
                                  ))
                                )}
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
            <p className="cart-section-label mb-2">{__("Order Discount")}</p>
            <div className="d-flex gap-2 cart-discount-row">
              <div style={{ flex: 1.4 }}>
                <SelectField
                  size="sm"
                  className="cart-discount-select"
                  placeholder={__("Apply on…")}
                  value={discountOn}
                  onChange={setDiscountOn}
                  disabled={!allowDiscountChange}
                  options={[
                    { label: __("Grand Total"), value: "Grand Total" },
                    { label: __("Net Total"), value: "Net Total" },
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
                  disabled={!allowDiscountChange}
                  onChange={(value) => setDiscount(value === "" ? "" : Math.min(value, 100))}
                />
              </div>
            </div>
            {!allowDiscountChange && (
              <div style={{ fontSize: 10.5, color: "var(--color-text-faint)" }} className="mt-1">
                {__("This POS Profile doesn't allow manual discount changes.")}
              </div>
            )}

            <div className="d-flex align-items-center gap-2 mt-2 cart-coupon-row">
              <div style={{ flex: 1 }}>
                <TextField
                  size="sm"
                  placeholder={__("Coupon code")}
                  value={couponInput}
                  onChange={setCouponInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setCouponCode(couponInput.trim());
                  }}
                />
              </div>
              <button
                type="button"
                className="pos-btn pos-btn-secondary"
                style={{ height: 30, fontSize: 11.5, padding: "0 10px" }}
                onClick={() => setCouponCode(couponInput.trim())}
                disabled={pricingLoading || !couponInput.trim()}
              >
                {__("Apply")}
              </button>
              {couponCode && (
                <button
                  type="button"
                  className="cart-clear-btn"
                  title={__("Remove coupon")}
                  onClick={() => {
                    setCouponCode("");
                    setCouponInput("");
                    setCouponError("");
                  }}
                >
                  <i className="bi bi-x-lg" />
                </button>
              )}
            </div>
            {couponCode && !couponError && (
              <div style={{ fontSize: 10.5, color: "var(--color-success-text)" }} className="mt-1">
                <i className="bi bi-check-circle me-1" />
                {__('Coupon "{code}" applied', { code: couponCode })}
              </div>
            )}
            {couponError && (
              <div style={{ fontSize: 10.5, color: "var(--color-danger-text)" }} className="mt-1">
                {couponError}
              </div>
            )}
          </div>

          {freeItems.length > 0 && (
            <div className="px-3 pt-1 pb-2">
              <p className="cart-section-label mb-2">{__("Free Items")}</p>
              {freeItems.map((item, i) => (
                <div
                  key={`free-${item.item_code}-${i}`}
                  className="d-flex justify-content-between align-items-center mb-1"
                  style={{ fontSize: 12 }}
                >
                  <span>
                    <i className="bi bi-gift-fill me-1" style={{ color: "var(--color-success-text)" }} />
                    {item.item_code} × {item.qty}
                  </span>
                  <span style={{ color: "var(--color-success-text)" }}>{__("FREE")}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Totals ── */}
          <div className="cart-totals px-3 py-2">
            <div className="d-flex justify-content-between mb-1">
              <span className="cart-total-label">{__("Item Total")}</span>
              <span className="cart-total-value">{formatAmount(itemTotal)}</span>
            </div>
            <div className="d-flex justify-content-between mb-1">
              <span className="cart-total-label">{__("Taxes")}</span>
              <span className="cart-total-value">{formatAmount(totalTaxAmount)}</span>
            </div>

            {taxRows.map((row) => (
              <div className="d-flex justify-content-between mb-1" key={row.account_head}>
                <span className="cart-total-label" style={{ paddingInlineStart: 10, fontSize: 11.5 }}>
                  {row.description || row.account_head} {row.rate ? `(${row.rate}%)` : ""}
                </span>
                <span className="cart-total-value" style={{ fontSize: 11.5 }}>
                  {formatAmount(row.tax_amount)}
                </span>
              </div>
            ))}

            {itemDiscountTotal > 0 && (
              <div className="d-flex justify-content-between mb-1">
                <span className="cart-total-label" style={{ color: "var(--color-success-text)" }}>{__("Item Discounts")}</span>
                <span className="cart-total-value" style={{ color: "var(--color-success-text)" }}>
                  – {formatAmount(itemDiscountTotal)}
                </span>
              </div>
            )}

            {offlinePricingUnresolved && (
              <div className="mb-2" style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                <i className="bi bi-cloud-slash me-1" />
                {__(
                  "A free-item offer in this cart needs a connection to resolve — pricing/discounts for this whole cart are on hold at list price until reconnected.",
                )}
              </div>
            )}

            {discountAmount > 0 && (
              <div className="d-flex justify-content-between mb-1">
                <span className="cart-total-label" style={{ color: "var(--color-success-text)" }}>
                  {__("Order Discount ({pct}%)", { pct: discount })}
                </span>
                <span className="cart-total-value" style={{ color: "var(--color-success-text)" }}>
                  – {formatAmount(discountAmount)}
                </span>
              </div>
            )}

            <div className="cart-grand-total d-flex justify-content-between align-items-center">
              <span>{__("Grand Total")}</span>
              <span>{formatAmount(grandTotal)}</span>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="px-3 pb-3 pt-1 position-relative cart-actions">
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
                      {__("Saving…")}
                    </>
                  ) : (
                    <>
                      <i className="bi bi-save2 me-1" />
                      {__("Save Draft")}
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
                  {__("Load Draft")}
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
                sendPaymentStatus({ status: "processing", grandTotal });
                setPayInvoice(true);
              }}
              disabled={cartItems.length === 0 || !customer}
            >
              <i className="bi bi-credit-card me-1" />
              {__("Pay {amount}", { amount: formatAmount(grandTotal) })}
            </button>
          </div>

        </div>{/* end card-body */}
      </div>{/* end card */}

      {payInvoice && (
        <InvoicePay
          onClose={() => setPayInvoice(false)}
          grandTotal={grandTotal}
          taxes={taxRows}
          onComplete={(details) => {
            sendInvoiceComplete(details);
            onSaleComplete?.();
          }}
        />
      )}

      {showDraftPicker && (
        <DraftPickerModal onClose={() => setShowDraftPicker(false)} onSelect={selectDraft} />
      )}

      {showNewCustomer && (
        <NewCustomerModal
          onClose={() => setShowNewCustomer(false)}
          onCreated={(doc) => {
            setCustomer(doc.name, doc.customer_name || doc.name);
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
