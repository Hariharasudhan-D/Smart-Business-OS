import { Navigate, Route, Routes } from 'react-router-dom';
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
export default function App() {
  return (
    <Routes>
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
    </Routes>
  );
}
