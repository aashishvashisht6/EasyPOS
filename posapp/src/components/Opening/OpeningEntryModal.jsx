import { useEffect, useState } from "react";
import { fetchCompanies } from "../../api/Company";
import { fetchProfile, fetchProfiles } from "../../api/POSProfile";
import { postOpeningEntry } from "../../api/OpeningEntry";

const OpeningEntryModal = ({ onSuccess }) => {
  const [openingForm, setOpeningForm] = useState({
    company: "",
    pos_profile: "",
    balance_details: [],
  });
  const [companies, setCompanies] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [profile, setProfile] = useState([]);

  const getCompanies = () => {
    fetchCompanies().then((data) => {
      setCompanies(data);
    });
  };

  const onChangeCompany = (event) => {
    const value = event.target.value;
    setOpeningForm({ ...openingForm, company: value });
    getProfiles(value);
  };

  const onChangeProfile = (event) => {
    const value = event.target.value;
    getPOSProfile(value);
    setOpeningForm({ ...openingForm, pos_profile: value });
  };

  const onChangePaymentAmount = (event, mode_of_payment) => {
    const balanceRow = openingForm?.balance_details.find(
      (row) => row.mode_of_payment === mode_of_payment,
    );
    if (!balanceRow) {
      const balance_details = openingForm?.balance_details;
      balance_details.push({
        mode_of_payment,
        opening_amount: event.target.value,
      });
      setOpeningForm({ ...openingForm, balance_details });
    } else {
      const balance_details = openingForm.balance_details.map((row) =>
        row.mode_of_payment === mode_of_payment
          ? { ...row, opening_amount: event.target.value }
          : row,
      );

      setOpeningForm({
        ...openingForm,
        balance_details,
      });
    }
  };

  const getPOSProfile = (pos_profile) => {
    fetchProfile(pos_profile).then((data) => {
      setProfile(data);  
    });
  };

  const getProfiles = (company) => {
    fetchProfiles(company).then((data) => {
      setProfiles(data);
    });
  };

  useEffect(() => {
    getCompanies();
  }, []);

  const submitOpeningEntry = () => {
    postOpeningEntry(openingForm).then(data => {
        if(data?.name){
            onSuccess(data)
        }
    })

  };

  return (
    <div className="container-fluid" style={{ minHeight: "100%" }}>
      <div
        className="modal show"
        style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
        tabIndex="-1"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">POS Opening Entry</h5>
            </div>

            <div className="modal-body">
              {/* Input fields for POS Opening Entry */}

              <div className="mb-3">
                <label className="form-label">Company</label>

                <select
                  className="form-select"
                  aria-label="Select Company"
                  value={openingForm.company}
                  defaultValue={"Select Company"}
                  onChange={onChangeCompany}
                >
                  <option value="" disabled={1}>
                    Select Company
                  </option>
                  {companies && companies.length > 0
                    ? companies.map((row, idx) => {
                        return (
                          <option key={idx} value={row.name}>
                            {row.company_name}
                          </option>
                        );
                      })
                    : null}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">POS Profile</label>
                <select
                  className="form-select"
                  aria-label="Select POS Profile"
                  value={openingForm.pos_profile}
                  onChange={onChangeProfile}
                  defaultValue={"Select Company"}
                >
                  <option value="" disabled={1}>
                    Select POS Profile
                  </option>
                  {profiles && profiles.length > 0
                    ? profiles.map((row, idx) => {
                        return (
                          <option key={idx} value={row.name}>
                            {row.name}
                          </option>
                        );
                      })
                    : null}
                </select>
              </div>

              {openingForm.company && openingForm.pos_profile && (
                <div className="mb-3 table-responsive">
                  <table className="table table-sm table-bordered align-middle mb-0">
                    <thead className="table-light sticky-top">
                      <tr className="text-align-center">
                        <th style={{ width: "50%", textAlign: "center" }}>
                          Mode Of Payment
                        </th>
                        <th style={{ width: "50%", textAlign: "center" }}>
                          Opening Amount
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {profile?.payments && profile.payments.length > 0
                        ? profile.payments.map((row, idx) => {
                            return (
                              <tr key={idx}>
                                <td>
                                  <input
                                    className="form-control border-white"
                                    placeholder="Mode Of Payment"
                                    readOnly={1}
                                    value={row.mode_of_payment}
                                  />
                                </td>
                                <td>
                                  <input
                                    className="form-control border-white"
                                    placeholder="Opening Amount"
                                    onChange={(event) =>
                                      onChangePaymentAmount(
                                        event,
                                        row.mode_of_payment,
                                      )
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
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={submitOpeningEntry}>Submit</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpeningEntryModal;
