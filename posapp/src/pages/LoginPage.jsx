import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import useLanguageStore from "../store/languageStore";
import { LANGUAGES, useTranslation } from "../translation";
import { TextField, CheckboxField, SelectField } from "../components/common";

const LoginPage = () => {
  const { __ } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);

  const [usr, setUsr] = useState("");
  const [pwd, setPwd] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!usr || !pwd) {
      setFieldError(__("Username and password are required"));
      return;
    }
    setFieldError("");
    setSubmitting(true);

    const success = await login(usr, pwd);
    if (!success) {
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    navigate("/posapp/terminal", { replace: true });
  };

  const displayError = fieldError || error;

  return (
    <div className="pos-login-shell">
      <div className="pos-login-card">
        {/* ── Brand panel ── */}
        <div className="pos-login-brand-panel">
          <div>
            <div className="pos-login-brand-header">
              <div className="pos-sidebar-logo" style={{ marginBottom: 0 }}>
                <i className="bi bi-display" />
              </div>
              <span>Easy POS</span>
            </div>

            <h1 className="pos-login-heading">
              {__("One counter.")}
              <br />
              {__("Every sale.")}
            </h1>
            <p className="pos-login-subheading">
              {__("Sign in to open your till and start ringing up sales.")}
            </p>

            <div className="pos-login-features">
              <div className="pos-login-feature">
                <i className="bi bi-lightning-charge-fill" />
                <span>{__("Checkout that keeps up during rush hour")}</span>
              </div>
              <div className="pos-login-feature">
                <i className="bi bi-receipt" />
                <span>{__("Every sale accounted for, down to the till")}</span>
              </div>
              <div className="pos-login-feature">
                <i className="bi bi-people-fill" />
                <span>{__("One login per cashier, one record per shift")}</span>
              </div>
            </div>
          </div>

          <p className="pos-login-footer">
            &copy; {new Date().getFullYear()} Easy POS. {__("Built for retail teams that never stop moving.")}
          </p>
        </div>

        {/* ── Form panel ── */}
        <div className="pos-login-form-panel">
          <div className="pos-login-form-inner">
            <div className="pos-inline-fields pos-login-language d-flex justify-content-end align-items-center gap-2 mb-3">
              <i className="bi bi-translate" style={{ color: "var(--color-text-faint)" }} />
              <SelectField
                aria-label={__("Language")}
                value={language}
                onChange={setLanguage}
                options={LANGUAGES.map((lang) => ({ label: lang.label, value: lang.code }))}
              />
            </div>
            <h2 className="pos-login-form-title">{__("Sign in")}</h2>
            <p className="pos-login-form-subtitle">
              {__("Enter your workstation credentials to start a shift.")}
            </p>

            {displayError && (
              <div className="alert alert-danger py-2" style={{ fontSize: 13 }}>
                {displayError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                label={__("Email or username")}
                placeholder="cashier@storefront.com"
                icon="bi-person"
                value={usr}
                onChange={setUsr}
                disabled={submitting}
                autoFocus
              />

              <TextField
                label={__("Password")}
                placeholder={__("Enter your password")}
                type={showPwd ? "text" : "password"}
                icon="bi-lock"
                trailingIcon={showPwd ? "bi-eye-slash" : "bi-eye"}
                trailingIconLabel={showPwd ? __("Hide password") : __("Show password")}
                onTrailingIconClick={() => setShowPwd((v) => !v)}
                value={pwd}
                onChange={setPwd}
                disabled={submitting}
              />

              <div className="pos-login-row">
                <CheckboxField
                  dense
                  label={__("Remember this device")}
                  checked={rememberDevice}
                  onChange={setRememberDevice}
                  className="pos-login-remember"
                />
                <button type="button" className="pos-login-link">
                  {__("Forgot password?")}
                </button>
              </div>

              <button
                type="submit"
                className="pos-btn pos-btn-primary w-100"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" />
                    {__("Signing in…")}
                  </>
                ) : (
                  <>
                    {__("Sign in")} <i className="bi bi-arrow-right" />
                  </>
                )}
              </button>
            </form>

            <div className="pos-login-divider">
              <div className="pos-login-divider-line" />
              <span className="pos-login-divider-label">{__("New here")}</span>
              <div className="pos-login-divider-line" />
            </div>

            <button type="button" className="pos-btn pos-btn-secondary w-100">
              <i className="bi bi-person-plus" /> {__("Create an account")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
