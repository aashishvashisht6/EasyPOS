import { useEffect, useRef } from "react";
import { Chart as FrappeChart } from "frappe-charts";
import "frappe-charts/dist/frappe-charts.min.css";

// Thin wrapper around frappe-charts (already a dependency of the Frappe
// framework, reused here instead of adding a new charting library). Reuse
// this for any new bar/line/pie/percentage chart instead of hand-rolling
// setup/teardown — see frappe-charts docs for the `data`/`type` shape.
//
// Reuses one chart instance across data changes via frappe-charts' own
// `.update(data)` (cheap re-render, no internal timers) instead of
// destroying/recreating a `new Chart(...)` on every prop change — the latter
// leaves a pending internal `setTimeout` (frappe-charts' post-init redraw)
// that can fire after the container's been torn down by a fast-following
// data change and throw an uncaught `removeChild` DOMException. Only
// destroy/recreate when the chart `type` itself changes, or on unmount.
const Chart = ({ data, type = "bar", height = 200, colors, ...options }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const typeRef = useRef(type);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data) return;

    if (chartRef.current && typeRef.current === type) {
      chartRef.current.update(data);
      return;
    }

    chartRef.current?.destroy?.();
    container.innerHTML = "";
    chartRef.current = new FrappeChart(container, { data, type, height, colors, ...options });
    // frappe-charts unconditionally wires up a ResizeObserver + window resize/
    // orientationchange listener per instance. PieChart specifically fires its
    // post-init redraw at 0ms (vs 700ms for bar/line — see PieChart's
    // `this.initTimeout = 0`), which races the ResizeObserver's own mandatory
    // first callback — both end up calling draw()->makeChartArea()->
    // removeChild(this.svg) around the same moment, and whichever loses throws
    // "not a child of this node". destroy() only strips the listeners (it
    // doesn't touch the rendered chart), so calling it immediately removes one
    // side of that race; `.update()` on later data changes is unaffected since
    // it re-renders via render(), not draw(). Trade-off: this chart no longer
    // auto-redraws on container/window resize, which is fine for a fixed-grid
    // dashboard card.
    chartRef.current.destroy();
    typeRef.current = type;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data), type, height, JSON.stringify(colors)]);

  // Real unmount only — tears down the one chart instance for good.
  useEffect(() => {
    const container = containerRef.current;
    return () => {
      chartRef.current?.destroy?.();
      chartRef.current = null;
      if (container) container.innerHTML = "";
    };
  }, []);

  return <div ref={containerRef} />;
};

export default Chart;
