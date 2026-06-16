import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppShell from './components/layout/AppShell';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Accounting from './pages/accounting/Accounting';
import Reports from './pages/reports/Reports';
import Inventory from './pages/inventory/Inventory';
import Crm from './pages/crm/Crm';
import Bookings from './pages/bookings/Bookings';
import Invoices from './pages/invoices/Invoices';
import Payments from './pages/payments/Payments';
import Hr from './pages/hr/Hr';
import Settings from './pages/Settings';
import DatabaseAdmin from './pages/admin/DatabaseAdmin';

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="accounting" element={<Accounting />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="crm" element={<Crm />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="payments" element={<Payments />} />
        <Route path="hr" element={<Hr />} />
        <Route path="reports" element={<Reports />} />
        <Route path="database" element={<DatabaseAdmin />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
