import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../store/authStore";
import usePOSSessionStore from "../../store/posSessionStore";
import useThemeStore from "../../store/themeStore";
import useLanguageStore from "../../store/languageStore";
import { LANGUAGES, tLabel, useTranslation } from "../../translation";
import useConnectivityStore from "../../engine/connectivity";
import useEngineSettingsStore from "../../engine/settingsStore";
import ClosingModal from "../Closing";

const getInitials = (name) => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
};

const Topbar = ({ title, searchValue, onSearchChange, searchPlaceholder, onScanClick }) => {
  const { __ } = useTranslation();
  const navigate = useNavigate();
  const openingDetail = usePOSSessionStore((s) => s.openingDetail);
  const hasOpeningEntry = usePOSSessionStore((s) => s.hasOpeningEntry);
  const fullName = useAuthStore((s) => s.user?.full_name);
  const email = useAuthStore((s) => s.user?.email);
  const logout = useAuthStore((s) => s.logout);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const offlineModeEnabled = useEngineSettingsStore((s) => s.offlineModeEnabled);
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const [showClosingModal, setShowClosingModal] = useState(false);

  const handleLogout = () => {
    logout().then(() => navigate("/posapp/login", { replace: true }));
  };

  return (
    <>
      <div className="pos-topbar">
        <div className="d-flex align-items-center gap-3">
          <span className="pos-topbar-title">{tLabel(__, title)}</span>
          {onSearchChange && (
            <div className={onScanClick ? "pos-search has-scan" : "pos-search"}>
              <i className="bi bi-search" />
              <input
                type="text"
                className={onScanClick ? "has-scan-btn" : ""}
                placeholder={searchPlaceholder ? __(searchPlaceholder) : __("Search...")}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
              />
              {onScanClick && (
                <button
                  type="button"
                  className="pos-search-scan-btn"
                  title={__("Scan with camera")}
                  aria-label={__("Scan with camera")}
                  onClick={onScanClick}
                >
                  <i className="bi bi-upc-scan" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="d-flex align-items-center gap-3">
          {offlineModeEnabled && (
            <div
              className="pos-status-pill"
              title={isOnline ? __("Connected to the server") : __("No connection — working from cached data")}
              style={
                isOnline
                  ? { background: "var(--color-success-bg)", color: "var(--color-success-text)" }
                  : { background: "var(--color-danger-bg)", color: "var(--color-danger-text)" }
              }
            >
              <span
                className="dot"
                style={{ background: isOnline ? "var(--color-success-icon)" : "var(--color-danger-text)" }}
              />
              <span className="pos-status-label">{isOnline ? __("Online") : __("Offline")}</span>
            </div>
          )}

          {hasOpeningEntry ? (
            <div className="pos-status-pill success">
              <span className="dot" />
              <span className="pos-status-label">{openingDetail?.pos_profile}</span>
            </div>
          ) : (
            <div className="pos-status-pill" style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)" }}>
              <span className="dot" style={{ background: "var(--color-warning-text-strong)" }} />
              <span className="pos-status-label">{__("No shift open")}</span>
            </div>
          )}

          {hasOpeningEntry && (
            <button
              type="button"
              className="pos-btn pos-btn-secondary pos-hide-mobile"
              style={{ height: 30, fontSize: 12, padding: "0 12px" }}
              onClick={() => setShowClosingModal(true)}
              disabled={offlineModeEnabled && !isOnline}
              title={offlineModeEnabled && !isOnline ? __("Reconnect to close your shift") : undefined}
            >
              {__("Close shift")}
            </button>
          )}

          <div className="position-relative">
            <button
              type="button"
              className="pos-icon-btn"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              title={__("Language")}
              aria-label={__("Language")}
            >
              <i className="bi bi-translate" />
            </button>
            <ul className="dropdown-menu dropdown-menu-end pos-user-menu pos-language-menu">
              {LANGUAGES.map((lang) => (
                <li key={lang.code}>
                  <button
                    type="button"
                    className={`dropdown-item pos-user-menu-item${lang.code === language ? " active" : ""}`}
                    onClick={() => setLanguage(lang.code)}
                  >
                    <i className={`bi ${lang.code === language ? "bi-check2" : "bi-dot"}`} />
                    {lang.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            className="pos-icon-btn pos-hide-mobile"
            title={theme === "dark" ? __("Switch to light mode") : __("Switch to dark mode")}
            aria-label={__("Toggle dark mode")}
            onClick={toggleTheme}
          >
            <i className={`bi ${theme === "dark" ? "bi-sun" : "bi-moon-stars"}`} />
          </button>

          <div className="position-relative">
            <button
              type="button"
              className="pos-user-trigger border-0"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <span className="pos-avatar pos-avatar-active">{getInitials(fullName)}</span>
              <i className="bi bi-chevron-down pos-user-trigger-caret" />
            </button>
            <ul className="dropdown-menu dropdown-menu-end pos-user-menu">
              <li className="pos-user-menu-header">
                <span className="pos-avatar pos-avatar-active pos-user-menu-avatar">{getInitials(fullName)}</span>
                <div className="pos-user-menu-identity">
                  <div className="pos-user-menu-name">{fullName || __("User")}</div>
                  {email && <div className="pos-user-menu-email">{email}</div>}
                </div>
              </li>
              <li>
                <hr className="pos-user-menu-divider" />
              </li>
              <li className="pos-show-mobile">
                <button className="dropdown-item pos-user-menu-item" onClick={toggleTheme}>
                  <i className={`bi ${theme === "dark" ? "bi-sun" : "bi-moon-stars"}`} />
                  {theme === "dark" ? __("Light mode") : __("Dark mode")}
                </button>
              </li>
              {hasOpeningEntry && (
                <li className="pos-show-mobile">
                  <button
                    className="dropdown-item pos-user-menu-item"
                    onClick={() => setShowClosingModal(true)}
                    disabled={offlineModeEnabled && !isOnline}
                  >
                    <i className="bi bi-door-closed" />
                    {__("Close shift")}
                  </button>
                </li>
              )}
              <li>
                <button className="dropdown-item pos-user-menu-item pos-user-menu-item-danger" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right" />
                  {__("Log out")}
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {showClosingModal && (
        <ClosingModal onClose={() => setShowClosingModal(false)} onConfirm={() => setShowClosingModal(false)} />
      )}
    </>
  );
};

export default Topbar;
