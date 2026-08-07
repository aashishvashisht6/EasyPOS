import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ErrorAlert } from "../components/common";
import usePOSSessionStore from "../store/posSessionStore";
import useEngineSettingsStore from "../engine/settingsStore";
import useConnectivityStore from "../engine/connectivity";
import { SYNC_DOMAINS, getDomainCounts, getLastSyncedTimes, runFullSync } from "../engine/sync";

const formatSyncedAt = (iso) => {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Never";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
};

const SyncPage = () => {
  const { setTopbar } = useOutletContext();
  const posProfile = usePOSSessionStore((s) => s.posProfile);
  const offlineModeEnabled = useEngineSettingsStore((s) => s.offlineModeEnabled);
  const isOnline = useConnectivityStore((s) => s.isOnline);

  const [selected, setSelected] = useState(SYNC_DOMAINS[0].key);
  const [counts, setCounts] = useState({});
  const [lastSynced, setLastSynced] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTopbar({ title: "Sync" });
  }, [setTopbar]);

  const refreshCacheState = useCallback(async () => {
    const [domainCounts, syncedTimes] = await Promise.all([getDomainCounts(), getLastSyncedTimes()]);
    setCounts(domainCounts);
    setLastSynced(syncedTimes);
  }, []);

  useEffect(() => {
    refreshCacheState();
  }, [refreshCacheState]);

  const runSync = async () => {
    setSyncing(true);
    setError("");
    try {
      await runFullSync(posProfile);
      await refreshCacheState();
    } catch (err) {
      setError(err?.message || "Sync failed. Check your connection and try again.");
    } finally {
      setSyncing(false);
    }
  };

  const selectedDomain = SYNC_DOMAINS.find((d) => d.key === selected);

  return (
    <div className="px-4 py-4" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div className="d-flex align-items-center justify-content-between mb-3" style={{ flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 16, color: "var(--color-text-primary)" }}>
            Sync center
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
            Master data cached for offline use. Fetch pulls the latest catalog, customers, and pricing from the server.
          </div>
        </div>
        <div className={`pos-status-pill ${isOnline ? "success" : "danger"}`}>
          <span className="dot" />
          {isOnline ? "Server connected" : "Offline"}
        </div>
      </div>

      {!offlineModeEnabled && (
        <div className="pos-card mb-3" style={{ padding: "12px 16px", fontSize: 12.5, color: "var(--color-text-muted)" }}>
          <i className="bi bi-info-circle me-2" />
          Offline mode isn't enabled for this deployment (EasyPOS Settings). Data still caches below for later, but the
          Terminal won't fall back to it while offline until it's turned on.
        </div>
      )}

      <ErrorAlert message={error} />

      <div style={{ flex: 1, display: "flex", gap: 16, minHeight: 0 }}>
        {/* Domain list */}
        <div className="pos-card" style={{ width: 240, flexShrink: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
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
            MASTER DATA
          </div>
          <div style={{ overflowY: "auto" }}>
            {SYNC_DOMAINS.map((d, idx) => {
              const active = d.key === selected;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setSelected(d.key)}
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
                    {d.label}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--color-text-faint)" }}>
                    {counts[d.key] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minWidth: 0, minHeight: 0 }}>
          <div className="pos-card" style={{ padding: "18px 20px", flexShrink: 0 }}>
            <div className="d-flex align-items-center justify-content-between mb-1">
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 14, color: "var(--color-text-primary)" }}>
                {selectedDomain?.label}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-faint)" }}>
                Last synced {formatSyncedAt(lastSynced[selectedDomain?.key])}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "0 0 16px" }}>
              {counts[selectedDomain?.key] ?? 0} record(s) cached locally. Master data is read-only offline — a Fetch
              pulls a fresh snapshot of every domain at once (they're all resolved together for the current shift's
              POS Profile).
            </p>
            <div className="d-flex" style={{ gap: 10 }}>
              <button
                type="button"
                className="pos-btn pos-btn-primary"
                disabled={syncing || !posProfile}
                onClick={runSync}
                title={!posProfile ? "Open a shift before syncing" : undefined}
              >
                <i
                  className={`bi ${syncing ? "bi-arrow-repeat" : "bi-download"}`}
                  style={syncing ? { animation: "pos-spin 0.8s linear infinite" } : undefined}
                />
                {syncing ? "Fetching…" : "Fetch from server"}
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
              ALL DOMAINS
            </div>
            <div style={{ overflowY: "auto" }}>
              {SYNC_DOMAINS.map((d, idx) => (
                <div
                  key={d.key}
                  className="d-flex align-items-center"
                  style={{
                    padding: "11px 16px",
                    gap: 10,
                    borderTop: idx === 0 ? "none" : "1px solid var(--color-border-faint)",
                  }}
                >
                  <i className="bi bi-check-lg" style={{ color: "var(--color-success-icon)", fontSize: 15 }} />
                  <span style={{ fontSize: 12, color: "var(--color-text-primary)", flex: 1 }}>
                    {d.label} — {counts[d.key] ?? 0} cached
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-faint)" }}>
                    {formatSyncedAt(lastSynced[d.key])}
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
