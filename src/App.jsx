import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import Login from './pages/Login';
import Layout from './components/layout/Layout';
import Overview from './pages/Overview';
import Products from './pages/Products';
import Purchases from './pages/Purchases';
import Sellers from './pages/Sellers';
import Contacts from './pages/Contacts';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Sales from './pages/Sales';
import InvoiceDetail from './pages/InvoiceDetail';
// Everything except /login needs the admin to be signed in; data is only fetched once they are.
function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return (
    <DataProvider>
      <Outlet />
    </DataProvider>
  );
}
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="products" element={<Navigate to="/products/selling" replace />} />
        <Route path="products/add" element={<Products key="manage" mode="manage" />} />
        <Route path="products/selling" element={<Products key="selling" mode="selling" />} />
        <Route path="products/purchase" element={<Products key="purchase" mode="purchase" />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="customers" element={<Navigate to="/customers/buyers" replace />} />
        <Route path="customers/add" element={<Contacts />} />
        <Route path="customers/buyers" element={<Customers />} />
        <Route path="customers/sellers" element={<Sellers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="sales" element={<Sales />} />
        <Route path="sales/:id" element={<InvoiceDetail />} />
        <Route path="*" element={<div className="py-20 text-center text-slate-500">Page not found</div>} />
      </Route>
      </Route>
    </Routes>
  );
}
