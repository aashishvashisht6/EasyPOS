import { Link, useLocation } from "react-router-dom";
import useAuthStore from "../../store/authStore";

const NAV_ITEMS = [
  { icon: "bi-display", label: "Terminal", to: "/posapp/terminal" },
  { icon: "bi-receipt", label: "Invoices", to: "/posapp/invoices" },
  { icon: "bi-people", label: "Customers", to: "/posapp/customers" },
  { icon: "bi-shop", label: "POS Profiles", to: "/posapp/pos-profile" },
  { icon: "bi-tag", label: "Item Prices", to: "/posapp/item-price" },
  { icon: "bi-list-ul", label: "Price Lists", to: "/posapp/price-list" },
  { icon: "bi-percent", label: "Discounts", to: "/posapp/discounts" },
  { icon: "bi-arrow-repeat", label: "Sync", comingSoon: true },
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
              title={item.label}
            >
              <i className={`bi ${item.icon}`} />
            </Link>
          ),
        )}
      </nav>

      <div className="pos-avatar">{getInitials(fullName)}</div>
    </div>
  );
};

export default Sidebar;
