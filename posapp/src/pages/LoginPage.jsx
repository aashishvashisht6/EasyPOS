import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { TextField, CheckboxField } from "../components/common";

const LoginPage = () => {
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
      setFieldError("Username and password are required");
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
              One counter.
              <br />
              Every sale.
            </h1>
            <p className="pos-login-subheading">
              Sign in to open your till and start ringing up sales.
            </p>

            <div className="pos-login-features">
              <div className="pos-login-feature">
                <i className="bi bi-lightning-charge-fill" />
                <span>Checkout that keeps up during rush hour</span>
              </div>
              <div className="pos-login-feature">
                <i className="bi bi-receipt" />
                <span>Every sale accounted for, down to the till</span>
              </div>
              <div className="pos-login-feature">
                <i className="bi bi-people-fill" />
                <span>One login per cashier, one record per shift</span>
              </div>
            </div>
          </div>

          <p className="pos-login-footer">
            &copy; {new Date().getFullYear()} Easy POS. Built for retail teams that never stop
            moving.
          </p>
        </div>

        {/* ── Form panel ── */}
        <div className="pos-login-form-panel">
          <div className="pos-login-form-inner">
            <h2 className="pos-login-form-title">Sign in</h2>
            <p className="pos-login-form-subtitle">
              Enter your workstation credentials to start a shift.
            </p>

            {displayError && (
              <div className="alert alert-danger py-2" style={{ fontSize: 13 }}>
                {displayError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                label="Email or username"
                placeholder="cashier@storefront.com"
                icon="bi-person"
                value={usr}
                onChange={setUsr}
                disabled={submitting}
                autoFocus
              />

              <TextField
                label="Password"
                placeholder="Enter your password"
                type={showPwd ? "text" : "password"}
                icon="bi-lock"
                trailingIcon={showPwd ? "bi-eye-slash" : "bi-eye"}
                trailingIconLabel={showPwd ? "Hide password" : "Show password"}
                onTrailingIconClick={() => setShowPwd((v) => !v)}
                value={pwd}
                onChange={setPwd}
                disabled={submitting}
              />

              <div className="pos-login-row">
                <CheckboxField
                  dense
                  label="Remember this device"
                  checked={rememberDevice}
                  onChange={setRememberDevice}
                  className="pos-login-remember"
                />
                <button type="button" className="pos-login-link">
                  Forgot password?
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
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in <i className="bi bi-arrow-right" />
                  </>
                )}
              </button>
            </form>

            <div className="pos-login-divider">
              <div className="pos-login-divider-line" />
              <span className="pos-login-divider-label">New here</span>
              <div className="pos-login-divider-line" />
            </div>

            <button type="button" className="pos-btn pos-btn-secondary w-100">
              <i className="bi bi-person-plus" /> Create an account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
