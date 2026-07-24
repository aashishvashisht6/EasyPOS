import { useEffect, useState } from "react";
import { fetchCompanies } from "../../api/Company";
import { fetchProfile, fetchProfiles } from "../../api/POSProfile";
import { postOpeningEntry } from "../../api/OpeningEntry";
import { fetchCurrencySymbol } from "../../api/Currency";
import usePOSSessionStore from "../../store/posSessionStore";
import { SelectField, CurrencyField, Modal } from "../common";

const OpeningEntryModal = () => {
  const isOpen = usePOSSessionStore((s) => s.openingModalOpen);
  const closeOpeningModal = usePOSSessionStore((s) => s.closeOpeningModal);
  const setOpeningEntry = usePOSSessionStore((s) => s.setOpeningEntry);

  const [companies, setCompanies] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [profile, setProfile] = useState(null);
  const [currencySymbol, setCurrencySymbol] = useState("");
  const [openingForm, setOpeningForm] = useState({
    company: "",
    pos_profile: "",
    balance_details: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) fetchCompanies().then((data) => setCompanies(data ?? []));
  }, [isOpen]);

  const onChangeCompany = (value) => {
    setOpeningForm({ company: value, pos_profile: "", balance_details: [] });
    setProfile(null);
    fetchProfiles(value).then((data) => setProfiles(data ?? []));
  };

  const onChangeProfile = (value) => {
    setOpeningForm((prev) => ({ ...prev, pos_profile: value, balance_details: [] }));
    fetchProfile(value).then((data) => {
      setProfile(data);
      if (data?.currency) fetchCurrencySymbol(data.currency).then(setCurrencySymbol);
      // Every payment mode on the profile is mandatory on submit — default
      // each to 0 so the cashier isn't forced to touch fields they don't use.
      setOpeningForm((prev) => ({
        ...prev,
        balance_details: (data?.payments ?? []).map((row) => ({
          mode_of_payment: row.mode_of_payment,
          opening_amount: 0,
        })),
      }));
    });
  };

  const onChangePaymentAmount = (mode_of_payment, amount) => {
    setOpeningForm((prev) => {
      const exists = prev.balance_details.some((row) => row.mode_of_payment === mode_of_payment);
      const balance_details = exists
        ? prev.balance_details.map((row) =>
            row.mode_of_payment === mode_of_payment ? { ...row, opening_amount: amount } : row,
          )
        : [...prev.balance_details, { mode_of_payment, opening_amount: amount }];
      return { ...prev, balance_details };
    });
  };

  const handleClose = () => {
    setOpeningForm({ company: "", pos_profile: "", balance_details: [] });
    setProfile(null);
    setCurrencySymbol("");
    setError("");
    closeOpeningModal();
  };

  const handleSubmit = () => {
    setError("");
    setSubmitting(true);
    postOpeningEntry(openingForm)
      .then((data) => {
        if (data?.name) {
          setOpeningEntry(data);
          handleClose();
        } else {
          setError("Failed to open till");
        }
      })
      .catch((err) => {
        setError(err?.response?.data?.exc_type || "Failed to open till");
      })
      .finally(() => setSubmitting(false));
  };

  if (!isOpen) return null;

  return (
    <Modal
      title="Open your till"
      subtitle="A shift needs to be open before you can ring up sales."
      onClose={handleClose}
      footer={
        <>
          <button type="button" className="pos-btn pos-btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button
            type="button"
            className="pos-btn pos-btn-primary"
            onClick={handleSubmit}
            disabled={submitting || !openingForm.company || !openingForm.pos_profile}
          >
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" />
                Opening…
              </>
            ) : (
              "Open till"
            )}
          </button>
        </>
      }
    >
      {error && <div className="alert alert-danger py-2">{error}</div>}

      <SelectField
        label="Company"
        placeholder="Select company"
        required
        value={openingForm.company}
        onChange={onChangeCompany}
        options={companies.map((c) => ({ label: c.company_name, value: c.name }))}
      />

      <SelectField
        label="POS Profile"
        placeholder="Select POS profile"
        required
        disabled={!openingForm.company}
        value={openingForm.pos_profile}
        onChange={onChangeProfile}
        options={profiles.map((p) => ({ label: p.name, value: p.name }))}
      />

      {profile?.payments?.length > 0 && (
        <div>
          <label className="pos-field-label">Opening balance</label>
          {profile.payments.map((row) => (
            <CurrencyField
              key={row.mode_of_payment}
              label={row.mode_of_payment}
              placeholder="0"
              min={0}
              currency={currencySymbol || undefined}
              value={
                openingForm.balance_details.find(
                  (b) => b.mode_of_payment === row.mode_of_payment,
                )?.opening_amount ?? ""
              }
              onChange={(value) => onChangePaymentAmount(row.mode_of_payment, value)}
            />
          ))}
        </div>
      )}
    </Modal>
  );
};

export default OpeningEntryModal;
