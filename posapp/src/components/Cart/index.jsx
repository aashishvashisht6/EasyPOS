import { useEffect, useState, useMemo, useContext } from "react";
import "./style.css";
import { fetchCustomers } from "../../api/Customer";
import { postDraftInvoice } from "../../api/Invoice";
import { POSContext } from "../Opening/POSProvider";
import InvoicePay from "../InvoicePay";

const Cart = ({ invoiceDetails, onChangeInvoice }) => {
  const { openingDetail } = useContext(POSContext);
  const [customers, setCustomers] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [saveDraft, setSaveDraft] = useState(false);
  const [payInvoice, setPayInvoice] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [discountOn, setDiscountOn] = useState("");
  const [discount, setDiscount] = useState("");

  const cartItems = invoiceDetails.items ?? [];

  const itemTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + (item.amount ?? 0), 0),
    [cartItems]
  );

  const discountAmount = useMemo(() => {
    const d = parseFloat(discount) || 0;
    if (!discountOn || !d) return 0;
    return parseFloat(((itemTotal * d) / 100).toFixed(2));
  }, [discount, discountOn, itemTotal]);

  const grandTotal = useMemo(
    () => parseFloat((itemTotal - discountAmount).toFixed(2)),
    [itemTotal, discountAmount]
  );

  const filteredCustomers = customers.filter((c) =>
    c.customer_name?.toLowerCase().includes(searchText.toLowerCase())
  );

  const getCustomers = () => {
    fetchCustomers().then((data) => setCustomers(data));
  };

  const clearCart = () => {
    onChangeInvoice({ ...invoiceDetails, items: [] });
    setExpandedIndex(null);
  };

  const removeItem = (index) => {
    const updated = cartItems.filter((_, i) => i !== index);
    onChangeInvoice({ ...invoiceDetails, items: updated });
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const updateItemField = (index, field, value) => {
    const updated = cartItems.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    onChangeInvoice({ ...invoiceDetails, items: updated });
  };

  const selectCustomer = (cust) => {
    onChangeInvoice({ ...invoiceDetails, customer: cust.name });
    setSearchText(cust.customer_name);
    setShowDropdown(false);
  };

  const clearCustomer = () => {
    setSearchText("");
    onChangeInvoice({ ...invoiceDetails, customer: "" });
  };

  const createDraftInvoice = () => {
    if (!invoiceDetails.customer) {
      alert("Please select a customer");
      return;
    }
    if (cartItems.length < 1) {
      alert("Please add at least one item to the cart");
      return;
    }
    setSaveDraft(true);
    postDraftInvoice(invoiceDetails, openingDetail, 0).then((data) => {
      if (data?.name) {
        setSaveDraft(false);
        onChangeInvoice({ ...invoiceDetails, sales_invoice: data.name });
      } else {
        alert("Failed to save draft");
        setSaveDraft(false);
      }
    });
  };

  useEffect(() => {
    getCustomers();
  }, []);

  return (
    <div className="cart-section p-2">
      <div className="card cart-section-card">

        {/* ── Header ── */}
        <div className="card-header d-flex align-items-center justify-content-between py-2 px-3 customer-cart-section">
          <h5 className="mb-0" style={{ fontSize: 15 }}>Shopping Cart</h5>
          <span className="badge bg-primary rounded-pill">{cartItems.length}</span>
        </div>

        <div className="card-body p-0 d-flex flex-column" style={{ minHeight: 0, flex: 1 }}>

          {/* ── Customer ── */}
          <div className="px-3 pt-2 pb-2 border-bottom position-relative">
            <p
              className="text-muted mb-1"
              style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}
            >
              Customer
            </p>

            {/* Selected pill */}
            {invoiceDetails.customer && !showDropdown ? (
              <div className="d-flex align-items-center gap-2 border rounded-2 px-2 py-1 bg-light">
                <div
                  className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-semibold flex-shrink-0"
                  style={{ width: 26, height: 26, fontSize: 10 }}
                >
                  {searchText?.slice(0, 2).toUpperCase()}
                </div>
                <span className="fw-medium text-dark" style={{ fontSize: 13 }}>
                  {searchText}
                </span>
                <button
                  className="btn btn-link btn-sm text-muted ms-auto p-0 text-decoration-none"
                  style={{ fontSize: 12 }}
                  onClick={clearCustomer}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white border-end-0">
                  <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16" className="text-muted">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.44 1.406a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
                  </svg>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search customer..."
                  value={searchText}
                  onChange={(e) => { setSearchText(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  style={{ fontSize: 13 }}
                />
              </div>
            )}

            {/* Dropdown */}
            {showDropdown && searchText && (
              <div
                className="dropdown-menu show w-100 p-0 shadow-sm border mt-1"
                style={{ maxHeight: 200, overflowY: "auto", zIndex: 200 }}
              >
                {filteredCustomers.length === 0 ? (
                  <div className="dropdown-item text-muted py-2" style={{ fontSize: 13 }}>
                    No customers found
                  </div>
                ) : (
                  filteredCustomers.slice(0, 10).map((cust) => (
                    <button
                      key={cust.name}
                      className="dropdown-item d-flex align-items-center gap-2 py-2 px-3"
                      onMouseDown={() => selectCustomer(cust)}
                    >
                      <div
                        className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-semibold flex-shrink-0"
                        style={{ width: 28, height: 28, fontSize: 11 }}
                      >
                        {cust.customer_name?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="fw-medium" style={{ fontSize: 13 }}>{cust.customer_name}</div>
                        {cust.mobile_no && (
                          <div className="text-muted" style={{ fontSize: 11 }}>{cust.mobile_no}</div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ── Cart Items ── */}
          <div className="d-flex flex-column" style={{ flex: 1, minHeight: 0 }}>

            {/* Toolbar */}
            <div className="d-flex align-items-center justify-content-between px-3 py-1 border-bottom">
              <p
                className="text-muted mb-0"
                style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}
              >
                Cart Items
              </p>
              {cartItems.length > 0 && (
                <button
                  className="btn btn-link btn-sm text-danger p-0 text-decoration-none"
                  style={{ fontSize: 12 }}
                  onClick={clearCart}
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Table */}
            <div className="overflow-auto" style={{ flex: 1 }}>
              {cartItems.length === 0 ? (
                <div className="d-flex flex-column align-items-center justify-content-center text-muted gap-2 py-5">
                  <svg width="30" height="30" fill="currentColor" viewBox="0 0 16 16" className="opacity-25">
                    <path d="M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H14.5a.5.5 0 0 1 .491.592l-1.5 8A.5.5 0 0 1 13 12H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5zM5 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                  </svg>
                  <span style={{ fontSize: 13 }}>No items in cart</span>
                </div>
              ) : (
                /* Key fix: table-layout fixed + matching col widths on th and td */
                <table
                  className="table table-sm table-hover align-middle mb-0"
                  style={{ fontSize: 13, tableLayout: "fixed", width: "100%" }}
                >
                  <colgroup>
                    <col style={{ width: "38%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "21%" }} />
                    <col style={{ width: "7%" }} />
                  </colgroup>
                  <thead className="table-light border-bottom">
                    <tr>
                      <th
                        className="ps-3 text-muted fw-semibold"
                        style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}
                      >
                        Item
                      </th>
                      <th
                        className="text-center text-muted fw-semibold"
                        style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}
                      >
                        Qty
                      </th>
                      <th
                        className="text-end text-muted fw-semibold"
                        style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}
                      >
                        Rate
                      </th>
                      <th
                        className="text-end text-muted fw-semibold"
                        style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}
                      >
                        Total
                      </th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {cartItems.map((item, index) => (
                      <>
                        <tr
                          key={`item-${index}`}
                          className={expandedIndex === index ? "table-primary" : ""}
                          style={{ cursor: "pointer" }}
                          onClick={() =>
                            setExpandedIndex(expandedIndex === index ? null : index)
                          }
                        >
                          <td className="ps-3">
                            <div
                              className="fw-medium text-truncate"
                              style={{ maxWidth: "100%" }}
                              title={item.item_code}
                            >
                              {item.item_code}
                            </div>
                            <div className="text-primary" style={{ fontSize: 10 }}>
                              {expandedIndex === index ? "▲ hide" : "▼ details"}
                            </div>
                          </td>
                          <td className="text-center">{item.qty}</td>
                          <td className="text-end">₹{(item.rate ?? 0).toLocaleString("en-IN")}</td>
                          <td className="text-end fw-semibold">
                            ₹{(item.amount ?? 0).toLocaleString("en-IN")}
                          </td>
                          <td className="text-center">
                            <button
                              className="btn btn-link btn-sm text-muted p-0 lh-1"
                              style={{ fontSize: 16 }}
                              title="Remove"
                              onClick={(e) => { e.stopPropagation(); removeItem(index); }}
                            >
                              &times;
                            </button>
                          </td>
                        </tr>

                        {/* Expanded detail */}
                        {expandedIndex === index && (
                          <tr key={`detail-${index}`} className="table-light">
                            {/* <td colSpan={5} className="px-3 py-2">
                              <div className="row g-2">
                                <div className="col-6">
                                  <label
                                    className="form-label text-muted mb-1"
                                    style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}
                                  >
                                    Serial No
                                  </label>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="Enter serial number"
                                    value={item.serial_no ?? ""}
                                    onChange={(e) => updateItemField(index, "serial_no", e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div className="col-6">
                                  <label
                                    className="form-label text-muted mb-1"
                                    style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}
                                  >
                                    Batch No
                                  </label>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="Enter batch number"
                                    value={item.batch_no ?? ""}
                                    onChange={(e) => updateItemField(index, "batch_no", e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                            </td> */}
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── Totals ── */}
          <div className="px-3 pt-2 pb-1 border-top">
            <div className="d-flex justify-content-between mb-1">
              <span className="text-muted" style={{ fontSize: 13 }}>Item Total</span>
              <span className="fw-medium" style={{ fontSize: 13 }}>₹{itemTotal.toLocaleString("en-IN")}</span>
            </div>
            <div className="d-flex justify-content-between mb-2">
              <span className="text-muted" style={{ fontSize: 13 }}>Taxes</span>
              <span className="fw-medium" style={{ fontSize: 13 }}>₹0</span>
            </div>

            {/* Discount */}
            <div className="row g-1 mb-1">
              <div className="col-7">
                <select
                  className="form-select form-select-sm"
                  value={discountOn}
                  onChange={(e) => setDiscountOn(e.target.value)}
                  style={{ fontSize: 12 }}
                >
                  <option value="" disabled>Discount on…</option>
                  <option value="Grand Total">Grand Total</option>
                  <option value="Net Total">Net Total</option>
                </select>
              </div>
              <div className="col-5">
                <div className="input-group input-group-sm">
                  <input
                    type="number"
                    className="form-control"
                    placeholder="0"
                    min={0}
                    max={100}
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    style={{ fontSize: 12 }}
                  />
                  <span className="input-group-text" style={{ fontSize: 12 }}>%</span>
                </div>
              </div>
            </div>

            {discountAmount > 0 && (
              <div className="d-flex justify-content-between mb-1">
                <span className="text-success" style={{ fontSize: 12 }}>
                  Discount ({discount}% on {discountOn})
                </span>
                <span className="text-success fw-medium" style={{ fontSize: 12 }}>
                  – ₹{discountAmount.toLocaleString("en-IN")}
                </span>
              </div>
            )}

            <hr className="my-2" />
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="fw-bold" style={{ fontSize: 14 }}>Grand Total</span>
              <span className="fw-bold" style={{ fontSize: 20 }}>₹{grandTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="px-3 pb-3 pt-1">
            <div className="row g-2 mb-2">
              <div className="col-6">
                <button
                  className="btn btn-outline-primary btn-sm w-100"
                  onClick={createDraftInvoice}
                  disabled={saveDraft}
                >
                  {saveDraft ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" />
                      Saving…
                    </>
                  ) : (
                    "Save Draft"
                  )}
                </button>
              </div>
              <div className="col-6">
                <button className="btn btn-outline-primary btn-sm w-100">
                  Load Draft
                </button>
              </div>
            </div>

            <button
              className="btn btn-primary w-100"
              onClick={() => setPayInvoice(true)}
              disabled={cartItems.length === 0 || !invoiceDetails.customer}
            >
              Pay ₹{grandTotal.toLocaleString("en-IN")}
            </button>
          </div>

        </div>{/* end card-body */}
      </div>{/* end card */}

      {payInvoice && (
        <InvoicePay
          onClose={() => setPayInvoice(false)}
          invoiceDetails={{ ...invoiceDetails, grandTotal, discountAmount, discountOn }}
          onChangeInvoice={onChangeInvoice}
        />
      )}
    </div>
  );
};

export default Cart;