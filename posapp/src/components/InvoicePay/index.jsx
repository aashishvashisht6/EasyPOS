import { useContext, useMemo, useState } from "react";
import { POSContext } from "../Opening/POSProvider";
import { postPaymentInvoice } from "../../api/Invoice";

const InvoicePay = ({ onClose, invoiceDetails, onChangeInvoice }) => {
  const [savePayInvoice, setSavePayinvoice] = useState(false);
  const { openingDetail } = useContext(POSContext);
  const balance_details = openingDetail.balance_details ?? [];
  const itemTotal = useMemo(() => {
    return (invoiceDetails?.items ?? []).reduce(
      (sum, item) => sum + parseFloat(item.amount),
      0,
    );
  }, [invoiceDetails?.items]);

  const grandTotal = itemTotal;

  const paidAmount = useMemo(() => {
    return (invoiceDetails?.payments ?? []).reduce(
      (sum, item) => sum + parseFloat(item.amount),
      0,
    );
  }, [invoiceDetails?.payments]);

  const handlePayment = (event, mode_of_payment) => {
    const balanceRow = invoiceDetails?.payments.find(
      (row) => row.mode_of_payment === mode_of_payment,
    );
    if (!balanceRow) {
      const payments = invoiceDetails?.payments;
      payments.push({
        mode_of_payment,
        amount: event.target.value,
      });
      onChangeInvoice({ ...invoiceDetails, payments });
    } else {
      const payments = invoiceDetails.payments.map((row) =>
        row.mode_of_payment === mode_of_payment
          ? { ...row, amount: event.target.value }
          : row,
      );

      onChangeInvoice({ ...invoiceDetails, payments });
    }
  };

  const createPaymentInvoice = () => {
    const customer = invoiceDetails.customer ?? "";
    const items = invoiceDetails.items ?? [];
    const payments = invoiceDetails.payments ?? [];
    if (!customer) {
      alert("Please Select Customer");
      return;
    }
    if (items.length < 1) {
      alert("Please Add one or more Items in Cart");
      return;
    }
    if (payments.length < 1) {
      alert("Please Add one or more Payment for Invoice");
      return;
    }
    setSavePayinvoice(true);
    postPaymentInvoice(invoiceDetails, openingDetail, 1).then((data) => {
      if (data?.name) {
        setSavePayinvoice(false);
        alert("Order Successful")
        onChangeInvoice({"customer": "", "items": [], "payments": []})
        onClose()
      }
      console.log(data);
    });
  };

  return (
    <>
      <div
        className="modal show"
        style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
        tabIndex="-1"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Invoice Payment</h5>
              <button
                type="button"
                class="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
                onClick={onClose}
              ></button>
            </div>

            <div className="modal-body">
              <div className="row mb-2">
                <div className="col-sm-6">
                  <div className="input-group mb-1">
                    <span className="input-group-text w-50">Net Total</span>
                    <input
                      type="text"
                      className="form-control"
                      disabled={1}
                      value={itemTotal}
                    />
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="input-group mb-1">
                    <span className="input-group-text w-50">Total Taxes</span>
                    <input
                      type="text"
                      className="form-control"
                      disabled={1}
                      value={0}
                    />
                  </div>
                </div>
              </div>

              <div className="row mb-2">
                <div className="col-sm-6">
                  <div className="input-group mb-1">
                    <span className="input-group-text w-50">
                      Discount Total
                    </span>
                    <input type="text" className="form-control" disabled={1} />
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="input-group mb-1">
                    <span className="input-group-text w-50">Grand Total</span>
                    <input
                      type="text"
                      className="form-control"
                      disabled={1}
                      value={grandTotal}
                    />
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="mb-3 table-responsive">
                  <table className="table table-sm table-bordered align-middle mb-0">
                    <thead className="table-light sticky-top">
                      <tr className="text-align-center">
                        <th style={{ width: "50%", textAlign: "center" }}>
                          Mode Of Payment
                        </th>
                        <th style={{ width: "50%", textAlign: "center" }}>
                          Amount
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {balance_details.length > 0
                        ? balance_details.map((row, idx) => {
                            return (
                              <tr key={idx}>
                                <td>
                                  <input
                                    className="form-control border-white"
                                    placeholder="Mode Of Payment"
                                    readOnly={1}
                                    value={row.mode_of_payment}
                                    disabled={1}
                                    style={{ background: "white" }}
                                  />
                                </td>
                                <td>
                                  <input
                                    className="form-control border-white"
                                    placeholder="Enter Amount"
                                    onChange={(event) =>
                                      handlePayment(event, row.mode_of_payment)
                                    }
                                  />
                                </td>
                              </tr>
                            );
                          })
                        : null}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Paid Amount Section */}
              <div className="row">
                <div className="col-sm-6">
                  <div className="input-group mb-1">
                    <span className="input-group-text w-50">Paid Amount</span>
                    <input
                      type="text"
                      className="form-control"
                      disabled={1}
                      value={paidAmount}
                    />
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="input-group mb-1">
                    <span className="input-group-text w-50">To Be Pay</span>
                    <input
                      type="text"
                      className="form-control"
                      disabled={1}
                      value={paidAmount - grandTotal}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={createPaymentInvoice}
                disabled={savePayInvoice ? 1 : 0}
              >
                {savePayInvoice ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2 text-primary"
                      role="status"
                    />
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InvoicePay;
