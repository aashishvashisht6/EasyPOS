import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../store/authStore";
import usePOSSessionStore from "../../store/posSessionStore";
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

const Topbar = ({ title, searchValue, onSearchChange, searchPlaceholder = "Search..." }) => {
  const navigate = useNavigate();
  const openingDetail = usePOSSessionStore((s) => s.openingDetail);
  const hasOpeningEntry = usePOSSessionStore((s) => s.hasOpeningEntry);
  const fullName = useAuthStore((s) => s.user?.full_name);
  const email = useAuthStore((s) => s.user?.email);
  const logout = useAuthStore((s) => s.logout);
  const [showClosingModal, setShowClosingModal] = useState(false);

  const handleLogout = () => {
    logout().then(() => navigate("/posapp/login", { replace: true }));
  };

  return (
    <>
      <div className="pos-topbar">
        <div className="d-flex align-items-center gap-3">
          <span className="pos-topbar-title">{title}</span>
          {onSearchChange && (
            <div className="pos-search">
              <i className="bi bi-search" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="d-flex align-items-center gap-3">
          {hasOpeningEntry ? (
            <div className="pos-status-pill success">
              <span className="dot" />
              {openingDetail?.pos_profile}
            </div>
          ) : (
            <div className="pos-status-pill" style={{ background: "var(--color-warning-bg)", color: "var(--color-warning-text)" }}>
              <span className="dot" style={{ background: "var(--color-warning-text-strong)" }} />
              No shift open
            </div>
          )}

          {hasOpeningEntry && (
            <button
              type="button"
              className="pos-btn pos-btn-secondary"
              style={{ height: 30, fontSize: 12, padding: "0 12px" }}
              onClick={() => setShowClosingModal(true)}
            >
              Close shift
            </button>
          )}

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
                  <div className="pos-user-menu-name">{fullName || "User"}</div>
                  {email && <div className="pos-user-menu-email">{email}</div>}
                </div>
              </li>
              <li>
                <hr className="pos-user-menu-divider" />
              </li>
              <li>
                <button className="dropdown-item pos-user-menu-item pos-user-menu-item-danger" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right" />
                  Log out
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
