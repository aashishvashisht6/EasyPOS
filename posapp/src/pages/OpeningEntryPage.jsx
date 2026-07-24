import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { fetchCompanies } from "../api/Company";
import { fetchProfile, fetchProfiles } from "../api/POSProfile";
import { postOpeningEntry } from "../api/OpeningEntry";
import usePOSSessionStore from "../store/posSessionStore";
import Logo from "../components/Logo";

const OpeningEntryPage = () => {
  const navigate = useNavigate();
  const setOpeningEntry = usePOSSessionStore((s) => s.setOpeningEntry);

  const [openingForm, setOpeningForm] = useState({
    company: "",
    pos_profile: "",
    balance_details: [],
  });
  const [companies, setCompanies] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [profile, setProfile] = useState([]);
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    postOpeningEntry(openingForm).then((data) => {
      setSubmitting(false);
      if (data?.name) {
        setOpeningEntry(data);
        navigate("/posapp/terminal", { replace: true });
      }
    });
  };

  return (
    <div
      className="d-flex justify-content-center align-items-center"
      style={{ minHeight: "100vh", background: "#F7F8FA" }}
    >
      <div className="card shadow-sm" style={{ width: "100%", maxWidth: 560 }}>
        <div className="card-header bg-white text-center border-0 pt-4">
          <Logo />
        </div>
        <div className="card-body p-4">
          <h5 className="mb-3">POS Opening Entry</h5>

          <div className="mb-3">
            <label className="form-label">Company</label>
            <select
              className="form-select"
              aria-label="Select Company"
              value={openingForm.company}
              onChange={onChangeCompany}
            >
              <option value="" disabled={1}>
                Select Company
              </option>
              {companies && companies.length > 0
                ? companies.map((row, idx) => (
                    <option key={idx} value={row.name}>
                      {row.company_name}
                    </option>
                  ))
                : null}
            </select>
          </div>

          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center">
              <label className="form-label mb-0">POS Profile</label>
              <Link to="/posapp/pos-profile" style={{ fontSize: 12 }}>
                Manage POS Profiles
              </Link>
            </div>
            <select
              className="form-select"
              aria-label="Select POS Profile"
              value={openingForm.pos_profile}
              onChange={onChangeProfile}
            >
              <option value="" disabled={1}>
                Select POS Profile
              </option>
              {profiles && profiles.length > 0
                ? profiles.map((row, idx) => (
                    <option key={idx} value={row.name}>
                      {row.name}
                    </option>
                  ))
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
                    ? profile.payments.map((row, idx) => (
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
                                onChangePaymentAmount(event, row.mode_of_payment)
                              }
                            />
                          </td>
                        </tr>
                      ))
                    : null}
                </tbody>
              </table>
            </div>
          )}

          <button
            className="btn btn-primary w-100"
            onClick={submitOpeningEntry}
            disabled={submitting || !openingForm.company || !openingForm.pos_profile}
          >
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" />
                Submitting…
              </>
            ) : (
              "Submit"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OpeningEntryPage;
