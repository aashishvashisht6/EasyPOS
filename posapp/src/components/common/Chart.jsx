import { useEffect, useRef } from "react";
import { Chart as FrappeChart } from "frappe-charts";
import "frappe-charts/dist/frappe-charts.min.css";

// Thin wrapper around frappe-charts (already a dependency of the Frappe
// framework, reused here instead of adding a new charting library). Reuse
// this for any new bar/line/pie/percentage chart instead of hand-rolling
// setup/teardown — see frappe-charts docs for the `data`/`type` shape.
const Chart = ({ data, type = "bar", height = 200, colors, ...options }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data) return;
    const chart = new FrappeChart(container, {
      data,
      type,
      height,
      colors,
      ...options,
    });
    return () => {
      container.innerHTML = "";
      chart.destroy?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data), type, height, JSON.stringify(colors)]);

  return <div ref={containerRef} />;
};

export default Chart;
