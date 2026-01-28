import { useEffect, useState } from "react";
import "./style.css";
import { fetchCustomers } from "../../api/Customer";

const Cart = () => {
  const [customers, setCustomers] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredCustomers = customers.filter((cust) =>
    cust.customer_name?.toLowerCase().includes(searchText.toLowerCase()),
  );

  const getCustomers = () => {
    fetchCustomers().then((data) => setCustomers(data));
  };
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
                    setSelectedCustomer(cust);
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
            <span className="btn btn-sm btn-danger">Clear</span>
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
            <div className="accordion accordion-flush" id="accordionItemFlush">
              <div className="accordion-item">
                <h2 className="accordion-header">
                  <button
                    className="accordion-button collapsed p-2"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#flush-collapseOne"
                    aria-expanded="false"
                    aria-controls="flush-collapseOne"
                  >
                    <div className="cart-grid w-100 cart-header p-2 text-center bg-white m-0">
                      <p className="m-0">Item Code</p>
                      <p className="m-0">Qty</p>
                      <p className="m-0">Rate</p>
                      <p className="m-0">Total</p>
                    </div>
                  </button>
                </h2>
                <div
                  id="flush-collapseOne"
                  className="accordion-collapse collapse"
                  data-bs-parent="#accordionFlushExample"
                >
                  <div className="accordion-body row col-12 container">
                    <div className="col-sm-12 col-md-6">
                      <div className="input-group mx-2">
                        <span
                          className="input-group-text"
                          id="inputGroup-sizing-default"
                        >
                          Serial No
                        </span>
                        <input
                          type="text"
                          className="form-control"
                          aria-label="Sizing example input"
                          aria-describedby="inputGroup-sizing-default"
                        />
                      </div>
                    </div>
                    <div className="col-sm-12 col-md-6">
                      <div className="input-group mx-2">
                        <span
                          className="input-group-text"
                          id="inputGroup-sizing-default"
                        >
                          Batch No
                        </span>
                        <input
                          type="text"
                          className="form-control"
                          aria-label="Sizing example input"
                          aria-describedby="inputGroup-sizing-default"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <hr />
          {/* Total Amount Section */}
          <div className="total-cart-section">
            <div className="row">
              <div className="discount-input col-sm-12 col-md-6">
                <div className="input-group mb-1">
                  <span
                    className="input-group-text"
                    id="inputGroup-sizing-default"
                  >
                    Item Total
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    aria-label="Sizing example input"
                    aria-describedby="inputGroup-sizing-default"
                  />
                </div>
              </div>

              <div className="discount-input col-sm-12 col-md-6">
                <div className="input-group mb-1">
                  <span
                    className="input-group-text"
                    id="inputGroup-sizing-default"
                  >
                    Taxes Total
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    aria-label="Sizing example input"
                    aria-describedby="inputGroup-sizing-default"
                  />
                </div>
              </div>
            </div>

            {/* Discount Input Fields */}
            <div className="row">
              <div className="discount-input col-sm-12 col-md-6">
                <div className="input-group mb-1">
                  <span
                    className="input-group-text"
                    id="inputGroup-sizing-default"
                  >
                    Apply Discount On
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    aria-label="Sizing example input"
                    aria-describedby="inputGroup-sizing-default"
                  />
                </div>
              </div>

              <div className="discount-input col-sm-12 col-md-6">
                <div className="input-group mb-1">
                  <span
                    className="input-group-text"
                    id="inputGroup-sizing-default"
                  >
                    Discount
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    aria-label="Sizing example input"
                    aria-describedby="inputGroup-sizing-default"
                  />
                </div>
              </div>
            </div>

            <div className="row mt-1">
              <div className="col-md-6 col-sm-12">
                <button className="btn btn-md btn-primary w-100">Save</button>
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
