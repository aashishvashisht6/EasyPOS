import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

const DOCTYPES = [
  { name: "Item", pending: 12, tone: "warning" },
  { name: "Customer", pending: 0 },
  { name: "Sales Invoice", pending: 3, tone: "danger" },
  { name: "Stock Entry", pending: 0 },
  { name: "Price List", pending: 0 },
];

const DOCTYPE_DETAIL = {
  Item: {
    lastSynced: "2m ago",
    description: "12 local changes ready to push. Fetch pulls the latest catalog from the server first.",
  },
  Customer: {
    lastSynced: "1h ago",
    description: "No local changes. Fetch pulls the latest customer records from the server.",
  },
  "Sales Invoice": {
    lastSynced: "38m ago",
    description: "3 local changes ready to push, including 1 conflict that needs review before uploading.",
  },
  "Stock Entry": {
    lastSynced: "3h ago",
    description: "No local changes. Fetch pulls the latest stock entries from the server.",
  },
  "Price List": {
    lastSynced: "1d ago",
    description: "No local changes. Fetch pulls the latest price lists from the server.",
  },
};

const RECENT_ACTIVITY = [
  { type: "success", text: "Uploaded 8 items", time: "14:02" },
  { type: "conflict", text: "Conflict on Sales Invoice INV-2039 · server copy is newer", time: "13:47" },
  { type: "success", text: "Fetched latest catalog · 240 items", time: "09:15" },
  { type: "success", text: "Uploaded 2 customers", time: "Yesterday" },
];

const SyncPage = () => {
  const { setTopbar } = useOutletContext();
  const [selected, setSelected] = useState(DOCTYPES[0].name);
  const [syncing, setSyncing] = useState(null); // "fetch" | "upload" | null

  useEffect(() => {
    setTopbar({ title: "Sync" });
  }, [setTopbar]);

  const detail = useMemo(() => DOCTYPE_DETAIL[selected], [selected]);
  const selectedDoctype = useMemo(() => DOCTYPES.find((d) => d.name === selected), [selected]);

  const runSync = (kind) => {
    setSyncing(kind);
    setTimeout(() => setSyncing(null), 1200);
  };

  return (
    <div className="px-4 py-4" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div
        className="d-flex align-items-center justify-content-between mb-3"
        style={{ flexShrink: 0 }}
      >
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 16, color: "var(--color-text-primary)" }}>
            Sync center
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
            Review pending changes and sync each doctype with the server.
          </div>
        </div>
        <div className="pos-status-pill success">
          <span className="dot" />
          Server connected
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: 16, minHeight: 0 }}>
        {/* Doctype list */}
        <div
          className="pos-card"
          style={{ width: 220, flexShrink: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
        >
          <div
            style={{
              padding: "11px 14px",
              fontSize: 11,
              fontWeight: 500,
              color: "var(--color-text-faint)",
              borderBottom: "1px solid var(--color-border-soft)",
              letterSpacing: "0.03em",
            }}
          >
            DOCTYPES
          </div>
          <div style={{ overflowY: "auto" }}>
            {DOCTYPES.map((d, idx) => {
              const active = d.name === selected;
              return (
                <button
                  key={d.name}
                  type="button"
                  onClick={() => setSelected(d.name)}
                  className="border-0 w-100"
                  style={{
                    padding: "11px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: active ? "var(--color-primary-tint-soft)" : "transparent",
                    borderTop: idx === 0 ? "none" : "1px solid var(--color-border-faint)",
                    borderLeft: active ? "3px solid var(--color-primary)" : "3px solid transparent",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12.5,
                      color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                      fontWeight: active ? 500 : 400,
                    }}
                  >
                    {d.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                      color: d.pending === 0 ? "var(--color-text-faint)" : undefined,
                      background:
                        d.pending === 0
                          ? "transparent"
                          : d.tone === "danger"
                          ? "var(--color-danger-bg)"
                          : "var(--color-warning-bg-soft)",
                      ...(d.pending !== 0 && {
                        color: d.tone === "danger" ? "var(--color-danger-text)" : "var(--color-warning-text)",
                        padding: "2px 6px",
                        borderRadius: 4,
                      }),
                    }}
                  >
                    {d.pending}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail + activity */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minWidth: 0, minHeight: 0 }}>
          <div className="pos-card" style={{ padding: "18px 20px", flexShrink: 0 }}>
            <div className="d-flex align-items-center justify-content-between mb-1">
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 14, color: "var(--color-text-primary)" }}>
                {selected}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-faint)" }}>
                Last synced {detail.lastSynced}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "0 0 16px" }}>{detail.description}</p>
            <div className="d-flex" style={{ gap: 10 }}>
              <button
                type="button"
                className="pos-btn pos-btn-secondary"
                disabled={syncing !== null}
                onClick={() => runSync("fetch")}
              >
                <i className={`bi ${syncing === "fetch" ? "bi-arrow-repeat" : "bi-download"}`} style={syncing === "fetch" ? { animation: "pos-spin 0.8s linear infinite" } : undefined} />
                {syncing === "fetch" ? "Fetching…" : "Fetch from server"}
              </button>
              <button
                type="button"
                className="pos-btn pos-btn-primary"
                disabled={syncing !== null || selectedDoctype.pending === 0}
                onClick={() => runSync("upload")}
              >
                <i className={`bi ${syncing === "upload" ? "bi-arrow-repeat" : "bi-upload"}`} style={syncing === "upload" ? { animation: "pos-spin 0.8s linear infinite" } : undefined} />
                {syncing === "upload"
                  ? "Uploading…"
                  : selectedDoctype.pending === 0
                  ? "No changes to upload"
                  : `Upload ${selectedDoctype.pending} changes`}
              </button>
            </div>
          </div>

          <div className="pos-card" style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div
              style={{
                padding: "11px 16px",
                fontSize: 11,
                fontWeight: 500,
                color: "var(--color-text-faint)",
                borderBottom: "1px solid var(--color-border-soft)",
                letterSpacing: "0.03em",
                flexShrink: 0,
              }}
            >
              RECENT ACTIVITY
            </div>
            <div style={{ overflowY: "auto" }}>
              {RECENT_ACTIVITY.map((item, idx) => (
                <div
                  key={idx}
                  className="d-flex align-items-center"
                  style={{
                    padding: "11px 16px",
                    gap: 10,
                    borderTop: idx === 0 ? "none" : "1px solid var(--color-border-faint)",
                    background: item.type === "conflict" ? "var(--color-danger-bg-soft)" : "transparent",
                  }}
                >
                  <i
                    className={`bi ${item.type === "conflict" ? "bi-exclamation-triangle" : "bi-check-lg"}`}
                    style={{
                      color: item.type === "conflict" ? "var(--color-danger-icon)" : "var(--color-success-icon)",
                      fontSize: 15,
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--color-text-primary)", flex: 1 }}>{item.text}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-faint)" }}>
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pos-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SyncPage;
