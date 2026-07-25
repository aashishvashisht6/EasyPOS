import { useEffect } from "react";
import { Link, useOutletContext } from "react-router-dom";

const SETTINGS_ITEMS = [
  {
    icon: "bi-award",
    label: "Loyalty Program",
    description: "Configure tiers, points and redemption rules",
    to: "/posapp/loyalty-program",
  },
  {
    icon: "bi-people",
    label: "Users",
    description: "Manage cashier accounts and permissions",
    comingSoon: true,
  },
];

const SettingsPage = () => {
  const { setTopbar } = useOutletContext();

  useEffect(() => {
    setTopbar({ title: "Settings" });
  }, [setTopbar]);

  return (
    <div className="px-4 py-4">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {SETTINGS_ITEMS.map((item) =>
          item.comingSoon ? (
            <div
              key={item.label}
              className="pos-card"
              style={{ padding: 20, opacity: 0.5, cursor: "default" }}
              title={`${item.label} — coming soon`}
            >
              <i className={`bi ${item.icon}`} style={{ fontSize: 22 }} />
              <div className="mt-2 fw-semibold">{item.label}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{item.description}</div>
            </div>
          ) : (
            <Link
              key={item.label}
              to={item.to}
              className="pos-card"
              style={{ padding: 20, display: "block", textDecoration: "none", color: "inherit" }}
            >
              <i className={`bi ${item.icon}`} style={{ fontSize: 22, color: "var(--color-primary)" }} />
              <div className="mt-2 fw-semibold">{item.label}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{item.description}</div>
            </Link>
          ),
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
