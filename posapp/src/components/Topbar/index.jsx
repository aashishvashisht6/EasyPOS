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
  const logout = useAuthStore((s) => s.logout);
  const [showClosingModal, setShowClosingModal] = useState(false);

  const handleLogout = () => {
    logout().then(() => navigate("/posapp/login", { replace: true }));
  };

  const handleToDesk = () => {
    window.location.href = `${window.location.origin}/app`;
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

          <div className="dropdown-center">
            <button
              type="button"
              className="pos-avatar pos-avatar-active border-0"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              style={{ cursor: "pointer" }}
            >
              {getInitials(fullName)}
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li>
                <button className="dropdown-item" onClick={handleLogout}>
                  Log out
                </button>
              </li>
              <li>
                <button className="dropdown-item" onClick={handleToDesk}>
                  Switch to desk
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
