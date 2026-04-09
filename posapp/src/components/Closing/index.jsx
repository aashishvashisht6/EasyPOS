import { useEffect, useContext, useState } from "react";
import { fetchClosingEntry, postClosingEntry } from "../../api/ClosingEntry";
import { POSContext } from "../Opening/POSProvider";

const ClosingModal = ({ onConfirm, onClose }) => {
  const [closingDetails, setClosingDetails] = useState([]);
  const { openingDetail, clearPOSContext } = useContext(POSContext);

  useEffect(() => {
    fetchClosingEntry(openingDetail).then((data) => {
      setClosingDetails(data);
    });
  }, []);

  const handleConfirm = () => {
    const closingData = {
      ...openingDetail,
      pos_opening_entry: openingDetail.name,
      closing_details: closingDetails,
    };
    postClosingEntry(closingData).then((response) => {
        if(response?.name){
            clearPOSContext();
            onConfirm();    
        }
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop show"
        style={{ zIndex: 1040 }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="modal show d-block"
        tabIndex="-1"
        style={{ zIndex: 1050 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content shadow">
            <div className="modal-header border-bottom">
              <h5 className="modal-title fw-semibold">Confirm Closing</h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={onClose}
              />
            </div>

            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">POS Opening Entry</label>
                <input
                  type="text"
                  className="form-control"
                  disabled
                  value={openingDetail?.name}
                />
              </div>
              <div className="mb-3 table-responsive">
                <table className="table table-sm table-bordered align-middle mb-0">
                  <thead className="table-light sticky-top">
                    <tr className="text-align-center">
                      <th style={{ width: "33%", textAlign: "center" }}>
                        Mode Of Payment
                      </th>
                      <th style={{ width: "33%", textAlign: "center" }}>
                        Opening Amount
                      </th>
                      <th style={{ width: "33%", textAlign: "center" }}>
                        Closing Amount
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {closingDetails.length > 0
                      ? closingDetails.map((row, idx) => {
                          return (
                            <tr key={idx}>
                              <td>
                                <input
                                  className="form-control border-white text-center"
                                  placeholder="Mode Of Payment"
                                  readOnly={1}
                                  value={row.mode_of_payment}
                                />
                              </td>
                              <td>
                                <input
                                  className="form-control border-white text-center"
                                  placeholder="Opening Amount"
                                  readOnly={1}
                                  value={row.opening_amount}
                                />
                              </td>
                              <td>
                                <input
                                  className="form-control border-white text-center"
                                  placeholder="Closing Amount"
                                  readOnly={1}
                                  value={row.closing_amount}
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

            <div className="modal-footer border-top">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleConfirm}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ClosingModal;
