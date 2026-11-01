import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useData } from '../context/DataContext';
import { saleLineTotal } from '../utils/calc';
import { formatDate, formatINR2 } from '../utils/format';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { sales, customers, products, loading } = useData();
  if (loading) return <Skeleton className="mx-auto h-96 max-w-3xl" />;
  const sale = sales.find((s) => s.id === id);
  if (!sale) {
    return (
      <Card>
        <EmptyState title="Invoice not found" action={<Button onClick={() => navigate('/sales')}>Back to sales</Button>} />
      </Card>
    );
  }
  const customer = customers.find((c) => c.id === sale.customerId);
  const productName = (pid) => products.find((p) => p.id === pid)?.name ?? 'Unknown product';
  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link to="/sales" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={14} /> All sales
        </Link>
        <Button onClick={() => window.print()}>
          <Printer size={16} /> Print
        </Button>
      </div>

      <div id="printable-invoice" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Smart Business OS</h1>
            <p className="mt-1 text-sm text-slate-500">12, Commercial Street, Bengaluru, Karnataka 560001</p>
            <p className="text-sm text-slate-500">GSTIN: 29ABCDE1234F1Z5</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tax Invoice</p>
            <p className="text-lg font-semibold text-slate-900">{sale.invoiceNo}</p>
            <p className="text-sm text-slate-500">Date: {formatDate(sale.date)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Billed to</p>
            <p className="mt-1 font-medium text-slate-900">{customer?.name ?? 'Walk-in customer'}</p>
            {customer && (
              <>
                <p className="text-sm text-slate-500">{customer.address}</p>
                <p className="text-sm text-slate-500">{customer.phone}</p>
              </>
            )}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Payment</p>
            <p className="mt-1 text-sm text-slate-700">{sale.paymentMode}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Disc.</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sale.items.map((i, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{productName(i.productId)}</td>
                  <td className="px-3 py-2 text-right">{i.qty}</td>
                  <td className="px-3 py-2 text-right">{formatINR2(i.price)}</td>
                  <td className="px-3 py-2 text-right">{i.discount}%</td>
                  <td className="px-3 py-2 text-right">{formatINR2(saleLineTotal(i))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto mt-6 w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatINR2(sale.subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Discount</span>
            <span>- {formatINR2(sale.discount)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
            <span>Total</span>
            <span>{formatINR2(sale.total)}</span>
          </div>
          <p className="text-right text-xs text-slate-400">Prices inclusive of GST</p>
        </div>

        <p className="mt-10 border-t border-slate-100 pt-4 text-center text-xs text-slate-400">Thank you for your business!</p>
      </div>
    </div>
  );
}
