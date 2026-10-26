import { useEffect, useState } from "react";
import BottomSheet from "../common/BottomSheet";
import { Link, useLocation } from "react-router-dom";
import useAuthStore from "../../store/authStore";
import { getPendingInvoiceCount } from "../../engine/outbox";
import { _t, useTranslation } from "../../translation";

const PENDING_COUNT_POLL_MS = 15000;

const NAV_ITEMS = [
  { icon: "bi-display", label: _t("Terminal"), to: "/posapp/terminal", primary: true },
  { icon: "bi-receipt", label: _t("Invoices"), to: "/posapp/invoices", primary: true },
  { icon: "bi-people", label: _t("Customers"), to: "/posapp/customers", primary: true },
  { icon: "bi-shop", label: _t("POS Profiles"), to: "/posapp/pos-profile" },
  { icon: "bi-tag", label: _t("Item Prices"), to: "/posapp/item-price" },
  { icon: "bi-list-ul", label: _t("Price Lists"), to: "/posapp/price-list" },
  { icon: "bi-percent", label: _t("Discounts"), to: "/posapp/discounts" },
  { icon: "bi-arrow-repeat", label: _t("Sync"), to: "/posapp/sync" },
  { icon: "bi-bar-chart", label: _t("Reports"), to: "/posapp/reports", primary: true },
  { icon: "bi-gear", label: _t("Settings"), to: "/posapp/settings" },
];

const getInitials = (name) => {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
};

const Sidebar = () => {
  const { __ } = useTranslation();
  const location = useLocation();
  const fullName = useAuthStore((s) => s.user?.full_name);

  // Lets a cashier notice unsynced offline sales (engine/outbox.js) without
  // opening Sync — polled rather than event-driven since queue writes happen
  // from several independent places (Cart, InvoicePay, connectivity's
  // reconnect push) and a light poll is simpler than wiring a pub/sub for it.
  const [pendingInvoiceCount, setPendingInvoiceCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => getPendingInvoiceCount().then((count) => !cancelled && setPendingInvoiceCount(count));
    refresh();
    const timer = setInterval(refresh, PENDING_COUNT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (item) => (item.activePrefixes ?? [item.to]).some((p) => location.pathname.startsWith(p));
  const primaryItems = NAV_ITEMS.filter((i) => i.primary);
  const moreItems = NAV_ITEMS.filter((i) => !i.primary);
  const moreActive = moreItems.some(isActive);
  const syncBadge = (item) => item.to === "/posapp/sync" && pendingInvoiceCount > 0;

  return (
    <>
    <div className="pos-sidebar">
      <div className="pos-sidebar-logo">
        <i className="bi bi-display" />
      </div>

      <nav className="pos-sidebar-nav">
        {NAV_ITEMS.map((item) =>
          item.comingSoon ? (
            <div
              key={item.label}
              className="pos-sidebar-item"
              style={{ opacity: 0.35, cursor: "default" }}
              title={__("{label} — coming soon", { label: __(item.label) })}
            >
              <i className={`bi ${item.icon}`} />
            </div>
          ) : (
            <Link
              key={item.label}
              to={item.to}
              className={`pos-sidebar-item ${
                (item.activePrefixes ?? [item.to]).some((p) => location.pathname.startsWith(p)) ? "active" : ""
              }`}
              title={
                item.to === "/posapp/sync" && pendingInvoiceCount > 0
                  ? __("{label} — {n} invoice(s) pending sync", { label: __(item.label), n: pendingInvoiceCount })
                  : __(item.label)
              }
              style={{ position: "relative" }}
            >
              <i className={`bi ${item.icon}`} />
              {item.to === "/posapp/sync" && pendingInvoiceCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    insetInlineEnd: 6,
                    minWidth: 15,
                    height: 15,
                    borderRadius: 8,
                    background: "var(--color-danger-text)",
                    color: "#fff",
                    fontSize: 9.5,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 3px",
                    lineHeight: 1,
                  }}
                >
                  {pendingInvoiceCount > 99 ? "99+" : pendingInvoiceCount}
                </span>
              )}
            </Link>
          ),
        )}
      </nav>

      <div className="pos-avatar">{getInitials(fullName)}</div>
    </div>

    {/* Phones (< 640px): the rail is hidden and these destinations move to a bottom tab bar. */}
    <nav className="pos-bottom-nav" aria-label={__("Main")}>
      {primaryItems.map((item) => (
        <Link key={item.label} to={item.to} className={`pos-bottom-nav-item${isActive(item) ? " active" : ""}`}>
          <i className={`bi ${item.icon}`} />
          <span>{__(item.label)}</span>
        </Link>
      ))}
      <button
        type="button"
        className={`pos-bottom-nav-item${moreActive ? " active" : ""}`}
        onClick={() => setMoreOpen(true)}
        aria-haspopup="dialog"
      >
        <i className="bi bi-grid" />
        {pendingInvoiceCount > 0 && <span className="pos-bottom-nav-dot" />}
        <span>{__("More")}</span>
      </button>
    </nav>

    <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title={__("More")}>
      <div className="pos-sheet-grid">
        {moreItems.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className={`pos-sheet-tile${isActive(item) ? " active" : ""}`}
            onClick={() => setMoreOpen(false)}
          >
            <i className={`bi ${item.icon}`} />
            <span>{__(item.label)}</span>
            {syncBadge(item) && <span className="pos-sheet-tile-badge">{pendingInvoiceCount > 99 ? "99+" : pendingInvoiceCount}</span>}
          </Link>
        ))}
      </div>
    </BottomSheet>
    </>
  );
};

export default Sidebar;
