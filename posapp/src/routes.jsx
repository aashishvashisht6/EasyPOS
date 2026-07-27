import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import useAuthStore from "./store/authStore";
import usePOSSessionStore from "./store/posSessionStore";
import AppLayout from "./components/Layout/AppLayout";

import LoginPage from "./pages/LoginPage";
import POSTerminalPage from "./pages/POSTerminalPage";
import InvoiceRegisterPage from "./pages/InvoiceRegisterPage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import CustomerListPage from "./pages/CustomerListPage";
import CustomerDetailPage from "./pages/CustomerDetailPage";
import SettingsPage from "./pages/SettingsPage";
import POSProfileListPage from "./pages/POSProfileListPage";
import POSProfileDetailPage from "./pages/POSProfileDetailPage";
import SyncPage from "./pages/SyncPage";
import ItemPriceListPage from "./pages/ItemPriceListPage";
import ItemPriceDetailPage from "./pages/ItemPriceDetailPage";
import PriceListListPage from "./pages/PriceListListPage";
import PriceListDetailPage from "./pages/PriceListDetailPage";
import DiscountListPage from "./pages/DiscountListPage";
import DiscountDetailPage from "./pages/DiscountDetailPage";
import LoyaltyProgramListPage from "./pages/LoyaltyProgramListPage";
import LoyaltyProgramDetailPage from "./pages/LoyaltyProgramDetailPage";
import ReportsPage from "./pages/ReportsPage";
import CustomerDisplayPage from "./pages/CustomerDisplayPage";

export function Spinner() {
  return (
    <div
      className="d-flex justify-content-center align-items-center"
      style={{ height: "100vh" }}
    >
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
}

function RequireAuth({ children }) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/posapp/login" replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  if (loading) return <Spinner />;
  if (user) return <Navigate to="/posapp/terminal" replace />;
  return children;
}

// Loads opening-entry status into the store without gating access to the page.
// Terminal/Invoices stay reachable with no shift open; screens that need an
// opening entry (adding to cart, proceeding from cart) prompt for one inline
// via OpeningEntryModal instead of bouncing the whole page.
function LoadOpeningEntry({ children }) {
  const user = useAuthStore((s) => s.user);
  const checkOpeningEntry = usePOSSessionStore((s) => s.checkOpeningEntry);

  useEffect(() => {
    if (user?.email) checkOpeningEntry(user.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return children;
}

function AppRoutes() {
  const checkSession = useAuthStore((s) => s.checkSession);

  useEffect(() => {
    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Routes>
      <Route
        path="/posapp/login"
        element={
          <RedirectIfAuthed>
            <LoginPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        element={
          <RequireAuth>
            <LoadOpeningEntry>
              <AppLayout />
            </LoadOpeningEntry>
          </RequireAuth>
        }
      >
        <Route path="/posapp/terminal" element={<POSTerminalPage />} />
        <Route path="/posapp/invoices" element={<InvoiceRegisterPage />} />
        <Route path="/posapp/invoices/:name" element={<InvoiceDetailPage />} />
        <Route path="/posapp/customers" element={<CustomerListPage />} />
        <Route path="/posapp/customers/:name" element={<CustomerDetailPage />} />
        <Route path="/posapp/settings" element={<SettingsPage />} />
        <Route path="/posapp/pos-profile" element={<POSProfileListPage />} />
        <Route path="/posapp/pos-profile/new" element={<POSProfileDetailPage />} />
        <Route path="/posapp/pos-profile/:name" element={<POSProfileDetailPage />} />
        <Route path="/posapp/item-price" element={<ItemPriceListPage />} />
        <Route path="/posapp/item-price/new" element={<ItemPriceDetailPage />} />
        <Route path="/posapp/item-price/:name" element={<ItemPriceDetailPage />} />
        <Route path="/posapp/price-list" element={<PriceListListPage />} />
        <Route path="/posapp/price-list/new" element={<PriceListDetailPage />} />
        <Route path="/posapp/price-list/:name" element={<PriceListDetailPage />} />
        <Route path="/posapp/discounts" element={<DiscountListPage />} />
        <Route path="/posapp/discounts/new" element={<DiscountDetailPage />} />
        <Route path="/posapp/discounts/:name" element={<DiscountDetailPage />} />
        <Route path="/posapp/loyalty-program" element={<LoyaltyProgramListPage />} />
        <Route path="/posapp/loyalty-program/new" element={<LoyaltyProgramDetailPage />} />
        <Route path="/posapp/loyalty-program/:name" element={<LoyaltyProgramDetailPage />} />
        <Route path="/posapp/sync" element={<SyncPage />} />
        <Route path="/posapp/reports" element={<ReportsPage />} />
      </Route>
      <Route
        path="/posapp/customer-display"
        element={
          <RequireAuth>
            <LoadOpeningEntry>
              <CustomerDisplayPage />
            </LoadOpeningEntry>
          </RequireAuth>
        }
      />
      <Route path="/posapp" element={<Navigate to="/posapp/terminal" replace />} />
      <Route path="*" element={<Navigate to="/posapp/terminal" replace />} />
    </Routes>
  );
}

export default AppRoutes;
