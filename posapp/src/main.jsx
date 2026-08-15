import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './theme/index.js'
import AppRoutes from './routes.jsx'
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./api/config.js";
import { fetchCsrfToken } from "./api/Auth.js";
import { initEngine } from "./engine/index.js";
import PwaUpdateBanner from "./pwa/PwaUpdateBanner.jsx";
import ToastContainer from "./components/common/ToastContainer.jsx";

// Production gets window.csrf_token from the Jinja template; the Vite dev
// server serves a plain index.html, so fetch it explicitly here too.
// initEngine() opens the local offline DB and loads the offline-mode flag —
// this must be awaited before the app mounts, or the first page's fetch
// effects can race ahead of it and hit the (possibly unreachable) server
// instead of the local DB. Failures (e.g. not logged in yet) are non-fatal
// and don't block app boot.
Promise.all([
  initEngine().catch(() => {}),
  fetchCsrfToken()
    .then((token) => { window.csrf_token = token; })
    .catch(() => {}),
]).finally(() => {
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <ToastContainer />
        <PwaUpdateBanner />
      </StrictMode>,
    )
  });
