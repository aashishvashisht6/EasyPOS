import { dateLocale } from "../utils/format";
import { __, _t, tData, useTranslation } from "../translation";
import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { fetchSalesReport, fetchPastShifts } from "../api/Reports";
import usePOSSessionStore from "../store/posSessionStore";
import useCurrencyFormatter from "../hooks/useCurrencyFormatter";
import {
  PageHeader,
  PageLoader,
  ErrorAlert,
  FilterChips,
  DateField,
  SelectField,
  StatTile,
  ReportCard,
  Chart,
  ChildTable,
} from "../components/common";

const SCOPE_OPTIONS = [
  { label: _t("Shift"), value: "shift", icon: "bi-clock-history" },
  { label: _t("Today"), value: "today", icon: "bi-sun" },
  { label: _t("Range"), value: "range", icon: "bi-calendar-range" },
];

// Theme-consistent palette (primary/success/warning/danger + two neutrals)
// so the payment-breakdown chart reads as an extension of the app's own
// badge/chip colors instead of frappe-charts' default random hues. frappe-charts
// paints these as literal SVG fills (no CSS var() resolution), and this array
// also backs the legend dots' inline `background`, so every entry must stay
// legible against both a white (light mode) and near-black (dark mode) card —
// avoid near-black/near-white neutrals here, they vanish in one theme or the
// other.
const CHART_COLOR_SEQUENCE = ["#f59e0b", "#16a34a", "#8b5cf6", "#dc2626", "#64748b", "#9aa1b2"];

const today = () => new Date().toISOString().slice(0, 10);

const ReportsPage = () => {
  // Re-render on language change; the module-level __ is used so the report
  // fetch effect below doesn't re-run when the language switches.
  useTranslation();
  const { openingDetail, hasOpeningEntry, posProfile } = usePOSSessionStore();
  const { setTopbar } = useOutletContext();

  const [scope, setScope] = useState(hasOpeningEntry ? "shift" : "today");
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [report, setReport] = useState(null);
  // Which currency Today/Range totals are in, when the cashier sold in more
  // than one (null = let the server pick the profile's / most-used one).
  const [reportCurrency, setReportCurrency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Which shift the "Shift" scope reports on — defaults to the currently
  // open one, but a cashier can switch to a past (closed) shift to review
  // its X/Z-style summary. pastShifts loads once; selectedShift is only
  // auto-defaulted until the cashier picks one themselves.
  const [pastShifts, setPastShifts] = useState([]);
  const [selectedShift, setSelectedShift] = useState(hasOpeningEntry ? openingDetail?.name : "");
  const [shiftTouched, setShiftTouched] = useState(false);

  useEffect(() => {
    fetchPastShifts().then((shifts) => setPastShifts(shifts ?? []));
  }, []);

  // openingDetail/pastShifts hydrate asynchronously after mount — default
  // the selected shift once they arrive, but don't clobber a shift the
  // cashier already picked from the dropdown themselves.
  useEffect(() => {
    if (shiftTouched) return;
    if (openingDetail?.name) setSelectedShift(openingDetail.name);
    else if (pastShifts.length) setSelectedShift(pastShifts[0].name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openingDetail?.name, pastShifts]);

  const shiftOptions = [
    ...(hasOpeningEntry && openingDetail?.name
      ? [{ value: openingDetail.name, label: __("Current shift · {profile}", { profile: openingDetail.pos_profile }) }]
      : []),
    ...pastShifts.map((s) => ({
      value: s.name,
      label: `${new Date(s.period_start_date).toLocaleString(dateLocale(), {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })} · ${s.pos_profile}`,
    })),
  ];

  // The report's own currency (a past shift may belong to a profile in another
  // currency than the open one) — see easy_pos.api.pos.get_sales_report.
  const formatCurrency = useCurrencyFormatter([report?.currency]);
  const money = (value) => formatCurrency(value, report?.currency);

  // Without this, the Topbar keeps showing whatever the previously visited
  // page set (title/search box) since this page never touched it.
  useEffect(() => {
    setTopbar({ title: _t("Reports") });
  }, [setTopbar]);

  useEffect(() => {
    const load = async () => {
      if (scope === "shift" && !selectedShift) {
        setReport(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      const data = await fetchSalesReport({
        scope,
        opening_entry: selectedShift,
        pos_profile: posProfile,
        from_date: scope === "today" ? today() : fromDate,
        to_date: scope === "today" ? today() : toDate,
        currency: reportCurrency,
      });
      if (data) setReport(data);
      else setError(__("Could not load report data."));
      setLoading(false);
    };
    load();
  }, [scope, fromDate, toDate, selectedShift, posProfile, reportCurrency]);

  const kpis = report?.kpis ?? {};

  const paymentChartData = report?.payment_breakdown?.length
    ? {
        labels: report.payment_breakdown.map((row) => tData(row.mode_of_payment)),
        datasets: [{ values: report.payment_breakdown.map((row) => row.amount) }],
      }
    : null;

  const trendChartData = report?.sales_trend?.length
    ? {
        labels: report.sales_trend.map((row) => row.label),
        datasets: [{ name: __("Sales"), values: report.sales_trend.map((row) => row.amount) }],
      }
    : null;

  const scopeChipOptions = SCOPE_OPTIONS.map((opt) => ({
    ...opt,
    label: (
      <>
        <i className={`bi ${opt.icon}`} style={{ fontSize: 12 }} /> {__(opt.label)}
      </>
    ),
  }));

  return (
    <div className="px-3 px-md-4 py-3 py-md-4">
      <PageHeader title={__("Reports")} subtitle={__("Your sales, shift, and payment summary")} />

      <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
        <FilterChips options={scopeChipOptions} value={scope} onChange={setScope} />
        {scope === "range" && (
          <div className="d-flex align-items-center gap-2 pos-inline-fields">
            <DateField value={fromDate} onChange={setFromDate} />
            <span className="text-muted">to</span>
            <DateField value={toDate} onChange={setToDate} />
          </div>
        )}
        {scope !== "shift" && report?.available_currencies?.length > 1 && (
          <FilterChips
            options={report.available_currencies.map((code) => ({ value: code, label: code }))}
            value={report.currency}
            onChange={setReportCurrency}
          />
        )}
        {scope === "shift" && shiftOptions.length > 0 && (
          <div className="pos-inline-fields" style={{ width: 240 }}>
            <SelectField
              value={selectedShift}
              onChange={(value) => {
                setShiftTouched(true);
                setSelectedShift(value);
              }}
              options={shiftOptions}
            />
          </div>
        )}
      </div>

      <ErrorAlert message={error} className="mb-3" />

      {loading ? (
        <PageLoader />
      ) : scope === "shift" && !selectedShift ? (
        <div className="pos-card">
          <div className="pos-report-empty">
            <i className="bi bi-cup-hot" />
            <p>
              {__("No shifts to report on yet. Open a shift from the Terminal to see live shift numbers here.")}
            </p>
            <Link to="/posapp/terminal" className="pos-btn pos-btn-primary">
              {__("Go to Terminal")}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div
            className="mb-3 pos-kpi-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}
          >
            <StatTile icon="bi-cash-stack" accent="primary" label={__("Gross sales")} value={money(kpis.gross_sales)} />
            <StatTile icon="bi-graph-up-arrow" accent="success" label={__("Net sales")} value={money(kpis.net_sales)} />
            <StatTile
              icon="bi-receipt"
              accent="neutral"
              label={__("Transactions")}
              value={kpis.transaction_count ?? 0}
            />
            <StatTile icon="bi-basket" accent="warning" label={__("Avg ticket")} value={money(kpis.avg_ticket)} />
          </div>

          <div
            className="mb-3"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}
          >
            {report?.shift_summary && (
              <ReportCard title={__("Shift summary")} icon="bi-cash-coin" accent="neutral">
                {report.shift_summary.details.length ? (
                  <div className="d-flex flex-column gap-2">
                    {report.shift_summary.details.map((row, idx) => (
                      <div
                        key={row.mode_of_payment}
                        className="d-flex align-items-center justify-content-between p-2"
                        style={{ background: "var(--color-surface-alt)", borderRadius: "var(--radius-md)" }}
                      >
                        <span className="d-flex align-items-center gap-2" style={{ fontSize: 13 }}>
                          <span
                            className="pos-mode-dot"
                            style={{ background: CHART_COLOR_SEQUENCE[idx % CHART_COLOR_SEQUENCE.length] }}
                          />
                          {tData(row.mode_of_payment)}
                        </span>
                        <span style={{ fontSize: 12.5 }} className="text-muted">
                          {money(row.opening_amount)} <i className="bi bi-arrow-right mx-1" />
                          <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>
                            {money(row.closing_amount)}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                    {__("No payment modes configured.")}
                  </p>
                )}
              </ReportCard>
            )}

            <ReportCard title={__("Payment method breakdown")} icon="bi-pie-chart" accent="primary">
              {paymentChartData ? (
                <Chart
                  data={paymentChartData}
                  type="pie"
                  height={220}
                  colors={CHART_COLOR_SEQUENCE}
                  tooltipOptions={{ formatTooltipY: (v) => money(v) }}
                />
              ) : (
                <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                  {__("No payments recorded in this period.")}
                </p>
              )}
            </ReportCard>
          </div>

          <ReportCard
            title={scope === "range" ? __("Sales trend · by day") : __("Sales trend · by hour")}
            icon="bi-bar-chart-line"
            accent="success"
            className="mb-3"
          >
            {trendChartData ? (
              <Chart
                data={trendChartData}
                type="bar"
                height={230}
                colors={["#f59e0b"]}
                tooltipOptions={{ formatTooltipY: (v) => money(v) }}
                barOptions={{ spaceRatio: 0.4 }}
              />
            ) : (
              <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                {__("No sales in this period.")}
              </p>
            )}
          </ReportCard>

          <div
            className="mb-3"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}
          >
            <ReportCard title={__("Top selling items")} icon="bi-star" accent="warning">
              {report?.top_items?.length ? (
                <div className="d-flex flex-column gap-3">
                  {report.top_items.map((item, idx) => {
                    const maxAmount = report.top_items[0]?.amount || 1;
                    const pct = Math.max(4, Math.round((item.amount / maxAmount) * 100));
                    return (
                      <div key={item.item_code} className="d-flex align-items-center gap-2">
                        <span className="pos-rank-badge">{idx + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="d-flex justify-content-between gap-2" style={{ fontSize: 13 }}>
                            <span className="text-truncate">{tData(item.item_name || item.item_code)}</span>
                            <span className="text-muted flex-shrink-0">{item.qty} qty · {money(item.amount)}</span>
                          </div>
                          <div className="pos-progress-track">
                            <div className="pos-progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                  {__("No items sold in this period.")}
                </p>
              )}
            </ReportCard>

            <ReportCard title={__("Discounts and returns")} icon="bi-receipt-cutoff" accent="danger">
              <div className="d-flex flex-column gap-2">
                <div className="d-flex align-items-center justify-content-between p-2" style={{ background: "var(--color-surface-alt)", borderRadius: "var(--radius-md)" }}>
                  <span className="d-flex align-items-center gap-2" style={{ fontSize: 13 }}>
                    <i className="bi bi-tag text-muted" /> {__("Discount given")}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {money(report?.discounts?.discount_amount)}{" "}
                    <span className="text-muted fw-normal">· {__("{n} invoices", { n: report?.discounts?.discount_count ?? 0 })}</span>
                  </span>
                </div>
                <div className="d-flex align-items-center justify-content-between p-2" style={{ background: "var(--color-surface-alt)", borderRadius: "var(--radius-md)" }}>
                  <span className="d-flex align-items-center gap-2" style={{ fontSize: 13 }}>
                    <i className="bi bi-arrow-return-left text-muted" /> {__("Credit notes")}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {money(report?.discounts?.return_amount)}{" "}
                    <span className="text-muted fw-normal">· {__("{n} returns", { n: report?.discounts?.return_count ?? 0 })}</span>
                  </span>
                </div>
              </div>
            </ReportCard>
          </div>

          <ReportCard
            title={__("Recent transactions")}
            icon="bi-list-ul"
            accent="neutral"
            actions={
              <Link to="/posapp/invoices" className="pos-btn pos-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 12px" }}>
                {__("View all")}
              </Link>
            }
          >
            <ChildTable
              emptyMessage={__("No transactions in this period.")}
              columns={[
                {
                  key: "name",
                  label: _t("Invoice"),
                  width: "1.4fr",
                  render: (row) => <Link to={`/posapp/invoices/${row.name}`}>{row.name}</Link>,
                },
                { key: "customer", label: _t("Customer"), width: "1.4fr", render: (row) => row.customer_name || __("Walk-in") },
                { key: "amount", label: _t("Amount"), width: "1fr", align: "end", render: (row) => money(row.grand_total) },
              ]}
              rows={report?.recent_invoices ?? []}
              rowKey="name"
            />
          </ReportCard>
        </>
      )}
    </div>
  );
};

export default ReportsPage;
