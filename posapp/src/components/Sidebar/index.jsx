import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import useAuthStore from "../../store/authStore";
import { getPendingInvoiceCount } from "../../engine/outbox";

const PENDING_COUNT_POLL_MS = 15000;

const NAV_ITEMS = [
  { icon: "bi-display", label: "Terminal", to: "/posapp/terminal" },
  { icon: "bi-receipt", label: "Invoices", to: "/posapp/invoices" },
  { icon: "bi-people", label: "Customers", to: "/posapp/customers" },
  { icon: "bi-shop", label: "POS Profiles", to: "/posapp/pos-profile" },
  { icon: "bi-tag", label: "Item Prices", to: "/posapp/item-price" },
  { icon: "bi-list-ul", label: "Price Lists", to: "/posapp/price-list" },
  { icon: "bi-percent", label: "Discounts", to: "/posapp/discounts" },
  { icon: "bi-arrow-repeat", label: "Sync", to: "/posapp/sync" },
  { icon: "bi-bar-chart", label: "Reports", to: "/posapp/reports" },
  { icon: "bi-gear", label: "Settings", to: "/posapp/settings" },
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

  return (
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
              title={`${item.label} — coming soon`}
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
                  ? `${item.label} — ${pendingInvoiceCount} invoice(s) pending sync`
                  : item.label
              }
              style={{ position: "relative" }}
            >
              <i className={`bi ${item.icon}`} />
              {item.to === "/posapp/sync" && pendingInvoiceCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 6,
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
  );
};

export default Sidebar;
