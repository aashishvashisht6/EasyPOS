import { dateLocale } from "../utils/format";
import { useCallback, useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { ErrorAlert } from "../components/common";
import usePOSSessionStore from "../store/posSessionStore";
import useEngineSettingsStore from "../engine/settingsStore";
import useConnectivityStore from "../engine/connectivity";
import { SYNC_DOMAINS, getDomainCounts, getLastSyncedTimes, runFullSync } from "../engine/sync";
import { getPendingInvoices, pushPendingInvoices, retryOfflineInvoice } from "../engine/outbox";
import { __, _t, useTranslation } from "../translation";

const formatSyncedAt = (iso) => {
  if (!iso) return __("Never");
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return __("Never");
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return __("Just now");
  if (diffMin < 60) return __("{n}m ago", { n: diffMin });
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return __("{n}h ago", { n: diffHr });
  return date.toLocaleDateString(dateLocale());
};

const formatCreatedAt = (iso) => {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(dateLocale());
};

const PENDING_STATUS_META = {
  queued: { label: _t("Queued"), cls: "bg-warning-subtle text-warning-emphasis" },
  syncing: { label: _t("Syncing…"), cls: "bg-primary-subtle text-primary" },
  failed: { label: _t("Failed"), cls: "bg-danger-subtle text-danger" },
  synced: { label: _t("Synced"), cls: "bg-success-subtle text-success" },
};

const SyncPage = () => {
  const { __ } = useTranslation();
  const { setTopbar } = useOutletContext();
  const navigate = useNavigate();
  const posProfile = usePOSSessionStore((s) => s.posProfile);
  const offlineModeEnabled = useEngineSettingsStore((s) => s.offlineModeEnabled);
  const isOnline = useConnectivityStore((s) => s.isOnline);

  const [selected, setSelected] = useState(SYNC_DOMAINS[0].key);
  const [counts, setCounts] = useState({});
  const [lastSynced, setLastSynced] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [pushingInvoices, setPushingInvoices] = useState(false);
  const [retryingId, setRetryingId] = useState("");
  const [invoiceError, setInvoiceError] = useState("");

  useEffect(() => {
    setTopbar({ title: _t("Sync") });
  }, [setTopbar]);

  const refreshPendingInvoices = useCallback(() => {
    getPendingInvoices().then((rows) => setPendingInvoices(rows.filter((r) => r.status !== "synced")));
  }, []);

  useEffect(() => {
    refreshPendingInvoices();
  }, [refreshPendingInvoices]);

  const runPushInvoices = async () => {
    setPushingInvoices(true);
    setInvoiceError("");
    try {
      await pushPendingInvoices();
    } catch (err) {
      setInvoiceError(err?.message || __("Push failed. Check your connection and try again."));
    } finally {
      setPushingInvoices(false);
      refreshPendingInvoices();
    }
  };

  const retryOne = async (offlineId) => {
    setRetryingId(offlineId);
    setInvoiceError("");
    const result = await retryOfflineInvoice(offlineId);
    setRetryingId("");
    if (!result?.ok) setInvoiceError(result?.error || __("Retry failed."));
    refreshPendingInvoices();
  };

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
      setError(err?.message || __("Sync failed. Check your connection and try again."));
    } finally {
      setSyncing(false);
    }
  };

  const selectedDomain = SYNC_DOMAINS.find((d) => d.key === selected);

  return (
    <div className="px-4 py-4" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div className="d-flex align-items-center justify-content-between mb-3 pos-sync-header" style={{ flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 16, color: "var(--color-text-primary)" }}>
            {__("Sync center")}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
            {__("Master data cached for offline use. Fetch pulls the latest catalog, customers, and pricing from the server.")}
          </div>
        </div>
        <div className={`pos-status-pill ${isOnline ? "success" : "danger"}`}>
          <span className="dot" />
          {isOnline ? __("Server connected") : __("Offline")}
        </div>
      </div>

      {!offlineModeEnabled && (
        <div className="pos-card mb-3" style={{ padding: "12px 16px", fontSize: 12.5, color: "var(--color-text-muted)" }}>
          <i className="bi bi-info-circle me-2" />
          {__(
            "Offline mode isn't enabled for this deployment (EasyPOS Settings). Data still caches below for later, but the Terminal won't fall back to it while offline until it's turned on.",
          )}
        </div>
      )}

      <ErrorAlert message={error} />

      <div className="pos-card mb-3" style={{ padding: "14px 16px", flexShrink: 0 }}>
        <div className="d-flex align-items-center justify-content-between mb-2 pos-sync-header">
          <div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 13.5, color: "var(--color-text-primary)" }}>
              {__("Pending Invoices")}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", marginTop: 2 }}>
              {__("Sales completed offline, queued locally until they reach ERPNext.")}
            </div>
          </div>
          <button
            type="button"
            className="pos-btn pos-btn-primary"
            disabled={pushingInvoices || !isOnline || pendingInvoices.every((r) => r.status !== "queued")}
            onClick={runPushInvoices}
            title={!isOnline ? __("Reconnect to push queued invoices") : undefined}
          >
            <i
              className={`bi ${pushingInvoices ? "bi-arrow-repeat" : "bi-upload"}`}
              style={pushingInvoices ? { animation: "pos-spin 0.8s linear infinite" } : undefined}
            />
            {pushingInvoices ? __("Pushing…") : __("Push now")}
          </button>
        </div>

        <ErrorAlert message={invoiceError} />

        {pendingInvoices.length === 0 ? (
          <div className="text-muted" style={{ fontSize: 12, padding: "8px 0" }}>
            {__("Nothing queued — every offline sale on this device has synced.")}
          </div>
        ) : (
          <div>
            {pendingInvoices.map((row) => {
              const meta = PENDING_STATUS_META[row.status] || PENDING_STATUS_META.queued;
              return (
                <div
                  key={row.offline_id}
                  className="d-flex align-items-center"
                  style={{ gap: 10, padding: "8px 0", borderTop: "1px solid var(--color-border-faint)" }}
                >
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0 text-start"
                    style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-primary)", cursor: "pointer" }}
                    onClick={() => navigate(`/posapp/invoices/${encodeURIComponent(row.display_id)}`)}
                  >
                    {row.display_id}
                  </button>
                  <span className={`badge ${meta.cls}`} style={{ fontSize: 10 }}>
                    {__(meta.label)}
                  </span>
                  {row.submit === false && (
                    <span className="badge bg-secondary-subtle text-secondary" style={{ fontSize: 10 }}>
                      {__("Draft")}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: "var(--color-text-faint)", flex: 1 }} title={row.error || undefined}>
                    {row.status === "failed" ? row.error : formatCreatedAt(row.created_at)}
                  </span>
                  {row.status === "failed" && (
                    <button
                      type="button"
                      className="pos-btn pos-btn-secondary"
                      style={{ height: 26, fontSize: 11, padding: "0 10px" }}
                      disabled={retryingId === row.offline_id}
                      onClick={() => retryOne(row.offline_id)}
                    >
                      {retryingId === row.offline_id ? __("Retrying…") : __("Retry")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pos-sync-split" style={{ flex: 1, display: "flex", gap: 16, minHeight: 0 }}>
        {/* Domain list */}
        <div className="pos-card pos-sync-list" style={{ width: 240, flexShrink: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
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
            {__("MASTER DATA")}
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
                    borderInlineStart: active ? "3px solid var(--color-primary)" : "3px solid transparent",
                    textAlign: "start",
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
                    {__(d.label)}
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
                {selectedDomain?.label && __(selectedDomain.label)}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-faint)" }}>
                {__("Last synced {when}", { when: formatSyncedAt(lastSynced[selectedDomain?.key]) })}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "0 0 16px" }}>
              {__(
                "{n} record(s) cached locally. Master data is read-only offline — a Fetch pulls a fresh snapshot of every domain at once (they're all resolved together for the current shift's POS Profile).",
                { n: counts[selectedDomain?.key] ?? 0 },
              )}
            </p>
            <div className="d-flex" style={{ gap: 10 }}>
              <button
                type="button"
                className="pos-btn pos-btn-primary"
                disabled={syncing || !posProfile}
                onClick={runSync}
                title={!posProfile ? __("Open a shift before syncing") : undefined}
              >
                <i
                  className={`bi ${syncing ? "bi-arrow-repeat" : "bi-download"}`}
                  style={syncing ? { animation: "pos-spin 0.8s linear infinite" } : undefined}
                />
                {syncing ? __("Fetching…") : __("Fetch from server")}
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
              {__("ALL DOMAINS")}
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
                    {__("{label} — {n} cached", { label: __(d.label), n: counts[d.key] ?? 0 })}
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
