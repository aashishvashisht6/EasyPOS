import { tData } from "../../i18n";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { fetchCompanies } from "../../api/Company";
import { fetchProfile, fetchProfilesForCompany } from "../../api/POSProfile";
import { postOpeningEntry } from "../../api/OpeningEntry";
import { fetchCurrencySymbol } from "../../api/Currency";
import { getServerMessage } from "../../utils/serverError";
import usePOSSessionStore from "../../store/posSessionStore";
import useConnectivityStore from "../../engine/connectivity";
import useEngineSettingsStore from "../../engine/settingsStore";
import { SelectField, CurrencyField, Modal, ErrorAlert } from "../common";

const OpeningEntryModal = () => {
  const { t } = useTranslation();
  const isOpen = usePOSSessionStore((s) => s.openingModalOpen);
  const closeOpeningModal = usePOSSessionStore((s) => s.closeOpeningModal);
  const setOpeningEntry = usePOSSessionStore((s) => s.setOpeningEntry);
  const offlineModeEnabled = useEngineSettingsStore((s) => s.offlineModeEnabled);
  const isOnline = useConnectivityStore((s) => s.isOnline);
  // Opening a shift resolves item stock/rate scoped to the chosen POS
  // Profile's own warehouse (easy_pos.api.sync.get_offline_snapshot) — a
  // profile never synced online before (or synced under a different
  // warehouse) would show wrong or missing stock with no way to re-resolve it
  // without connectivity, so opening (and closing, see Topbar) a shift always
  // requires being online, even with offline mode enabled for mid-shift sales.
  const blockedOffline = offlineModeEnabled && !isOnline;

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
    fetchProfilesForCompany(value).then((data) => setProfiles(data ?? []));
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
          setError(t("Failed to open till"));
        }
      })
      .catch((err) => {
        setError(getServerMessage(err) || err?.response?.data?.exc_type || t("Failed to open till"));
      })
      .finally(() => setSubmitting(false));
  };

  if (!isOpen) return null;

  return (
    <Modal
      title={t("Open your till")}
      subtitle={t("A shift needs to be open before you can ring up sales.")}
      onClose={handleClose}
      footer={
        <>
          <button type="button" className="pos-btn pos-btn-secondary" onClick={handleClose}>
            {t("Cancel")}
          </button>
          <button
            type="button"
            className="pos-btn pos-btn-primary"
            onClick={handleSubmit}
            disabled={blockedOffline || submitting || !openingForm.company || !openingForm.pos_profile}
            title={blockedOffline ? t("Reconnect to open a shift") : undefined}
          >
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" />
                {t("Opening…")}
              </>
            ) : (
              t("Open till")
            )}
          </button>
        </>
      }
    >
      {blockedOffline && (
        <div className="text-muted mb-3" style={{ fontSize: 12.5 }}>
          <i className="bi bi-cloud-slash me-1" />
          {t(
            "Opening a shift requires an internet connection — stock and pricing for the profile you pick have to be resolved live. Reconnect to open your till.",
          )}
        </div>
      )}

      <ErrorAlert message={error} />

      <SelectField
        label={t("Company")}
        placeholder={t("Select company")}
        required
        value={openingForm.company}
        onChange={onChangeCompany}
        options={companies.map((c) => ({ label: c.company_name, value: c.name }))}
      />

      <SelectField
        label={t("POS Profile")}
        placeholder={t("Select POS profile")}
        required
        disabled={!openingForm.company}
        value={openingForm.pos_profile}
        onChange={onChangeProfile}
        options={profiles.map((p) => ({ label: p.name, value: p.name }))}
      />

      {profile?.payments?.length > 0 && (
        <div>
          <label className="pos-field-label">{t("Opening balance")}</label>
          {profile.payments.map((row) => (
            <CurrencyField
              key={row.mode_of_payment}
              label={tData(row.mode_of_payment)}
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
