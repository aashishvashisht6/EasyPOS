import { useEffect, useState, useMemo, useContext } from "react";
import "./style.css";
import { fetchCustomers } from "../../api/Customer";
import { postDraftInvoice } from "../../api/Invoice";
import { POSContext } from "../Opening/POSProvider";

const Cart = ({ invoiceDetails, onChangeInvoice }) => {
  const { openingDetail } = useContext(POSContext);
  const [customers, setCustomers] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const cartItems = invoiceDetails.items ?? [];

  const itemTotal = useMemo(() => {
    return (invoiceDetails?.items ?? []).reduce(
      (sum, item) => sum + item.amount,
      0,
    );
  }, [invoiceDetails?.items]);

  const filteredCustomers = customers.filter((cust) =>
    cust.customer_name?.toLowerCase().includes(searchText.toLowerCase()),
  );

  const clearCart = () => {
    onChangeInvoice({ ...invoiceDetails, items: [] });
  };

  const getCustomers = () => {
    fetchCustomers().then((data) => setCustomers(data));
  };

  const createDraftInvoice = () => {
    const customer = invoiceDetails.customer ?? "";
    const items = invoiceDetails.items ?? [];
    if(!customer){
      alert("Please Select Customer")
      return
    }
    if(items.length < 1){
      alert("Please Add one or more Items in Cart")
      return 
    }
    postDraftInvoice(invoiceDetails, openingDetail, 0).then(data => {
      console.log(data)
    })
  }

  useEffect(() => {
    getCustomers();
  }, []);

  return (
    <div className="cart-section p-2">
      <div className="card cart-section-card p-3">
        <h5 className="ml-2">Shopping Cart</h5>
        <hr />
        <div className="customer-cart-section position-relative">
          <div className="input-group mb-0">
            <span className="input-group-text">Customer</span>
            <input
              type="text"
              className="form-control"
              value={searchText}
              placeholder="Search customer..."
              onChange={(e) => {
                setSearchText(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
            />
          </div>

          {/* Dropdown */}
          {showDropdown && searchText && (
            <div
              className="dropdown-menu show w-100 mt-1"
              style={{ maxHeight: "200px", overflowY: "auto" }}
            >
              {filteredCustomers.length === 0 && (
                <div className="dropdown-item text-muted">
                  No customers found
                </div>
              )}

              {filteredCustomers.slice(0, 10).map((cust) => (
                <button
                  key={cust.name}
                  className="dropdown-item h-50"
                  onClick={() => {
                    onChangeInvoice({ ...invoiceDetails, customer: cust.name });
                    setSearchText(cust.customer_name);
                    setShowDropdown(false);
                  }}
                >
                  <div className="fw-semibold">{cust.customer_name}</div>
                  {cust.mobile_no && (
                    <small className="text-muted">{cust.mobile_no}</small>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <hr />
        <div className="cart-item-section">
          <div className="d-flex justify-content-between align-items-center">
            <h6 className="mb-0">Cart Details</h6>
            <span className="btn btn-sm btn-danger" onClick={clearCart}>
              Clear
            </span>
          </div>

          {/* Item cart Section */}
          <div
            className="card mt-1"
            style={{
              minHeight: "21rem",
              maxHeight: "21rem",
              overflowY: "scroll",
            }}
          >
            {/* Header row */}
            <div className="cart-grid cart-header p-2 text-center bg-white fw-bold">
              <div>Item Code</div>
              <div>Qty</div>
              <div>Rate</div>
              <div>Total</div>
            </div>

            <div className="accordion accordion-flush" id="cartAccordion">
              {cartItems.map((item, index) => (
                <div className="accordion-item" key={index}>
                  <h2 className="accordion-header">
                    <button
                      className="accordion-button collapsed p-2"
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target={`#cart-collapse-${index}`}
                    >
                      <div className="cart-grid w-100 text-center">
                        <div>{item.item_code}</div>
                        <div>{item.qty}</div>
                        <div>{item.rate}</div>
                        <div>{item.amount}</div>
                      </div>
                    </button>
                  </h2>

                  <div
                    id={`cart-collapse-${index}`}
                    className="accordion-collapse collapse"
                    data-bs-parent="#cartAccordion"
                  >
                    <div className="accordion-body">
                      <div className="row g-2">
                        <div className="col-md-6">
                          <div className="input-group">
                            <span className="input-group-text">Serial No</span>
                            <input type="text" className="form-control" />
                          </div>
                        </div>

                        <div className="col-md-6">
                          <div className="input-group">
                            <span className="input-group-text">Batch No</span>
                            <input type="text" className="form-control" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <hr />
          {/* Total Amount Section */}
          <div className="total-cart-section">
            <div className="row">
              <div className="discount-input col-sm-12 col-md-6">
                <div className="input-group mb-1">
                  <span className="input-group-text w-50">Item Total</span>
                  <input type="text" className="form-control" disabled={1} value={itemTotal} />
                </div>
              </div>

              <div className="discount-input col-sm-12 col-md-6">
                <div className="input-group mb-1">
                  <span className="input-group-text w-50">Taxes Total</span>
                  <input type="text" className="form-control" disabled={1} value={0} />
                </div>
              </div>
            </div>

            {/* Discount Input Fields */}
            <div className="row">
              <div className="discount-input col-sm-12 col-md-6">
                <div className="input-group mb-1">
                  <span className="input-group-text w-50">Discount On</span>
                  <select className="form-control">
                    <option selected disabled={1}>
                      Discount On
                    </option>
                    <option value="Grand Total">Grand Total</option>
                    <option value="Net Total">Net Total</option>
                  </select>
                </div>
              </div>

              <div className="discount-input col-sm-12 col-md-6">
                <div className="input-group mb-1">
                  <span className="input-group-text w-50">Discount</span>
                  <input type="text" className="form-control" />
                </div>
              </div>
            </div>

            <div className="row mt-1">
              <div className="col-md-6 col-sm-12">
                <button className="btn btn-md btn-primary w-100" onClick={createDraftInvoice}>Save</button>
              </div>
              <div className="col-md-6 col-sm-12">
                <button className="btn btn-md btn-primary w-100">
                  Load Draft
                </button>
              </div>
            </div>

            <div className="row mt-2">
              <div className="col-12 ">
                <button className="btn btn-md btn-success w-100">
                  Pay Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
