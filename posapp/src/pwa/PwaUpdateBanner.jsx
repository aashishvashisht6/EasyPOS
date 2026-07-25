import { useEffect, useRef, useState } from "react";
import { Workbox } from "workbox-window";

// The built sw.js is emitted alongside the JS/CSS bundle under
// /assets/easy_pos/posapp/, but a worker's default scope is limited to the
// directory it's served from and the app's routes live under /posapp/. This
// whitelisted endpoint (easy_pos/api/pwa.py) re-serves the same file with a
// Service-Worker-Allowed header so it can be registered with an explicit
// /posapp/ scope instead.
const SW_URL = "/api/method/easy_pos.api.pwa.service_worker";
const SW_SCOPE = "/posapp/";

const PwaUpdateBanner = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const wbRef = useRef(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;

    const wb = new Workbox(SW_URL, { scope: SW_SCOPE });
    wbRef.current = wb;

    wb.addEventListener("waiting", () => setNeedRefresh(true));
    wb.addEventListener("controlling", () => window.location.reload());

    wb.register();
  }, []);

  if (!needRefresh) return null;

  return (
    <div
      className="pos-card d-flex align-items-center gap-3"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 2000,
        padding: "12px 16px",
      }}
    >
      <span style={{ fontSize: 13.5 }}>A new version of Easy POS is available.</span>
      <button
        type="button"
        className="pos-btn pos-btn-primary"
        onClick={() => wbRef.current?.messageSkipWaiting()}
      >
        Reload
      </button>
      <button type="button" className="pos-btn" onClick={() => setNeedRefresh(false)}>
        Dismiss
      </button>
    </div>
  );
};

export default PwaUpdateBanner;
