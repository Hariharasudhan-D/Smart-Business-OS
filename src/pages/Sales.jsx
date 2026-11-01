import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { saleLineTotal, saleTotals } from '../utils/calc';
import { formatDate, formatINR, formatINR2, todayISO } from '../utils/format';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import Pagination from '../components/ui/Pagination';
import SearchInput from '../components/ui/SearchInput';
import Select from '../components/ui/Select';
import { ProductFormModal } from './Products';
import { ContactFormModal } from './Contacts';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Table, TBody, Td, Th, THead } from '../components/ui/Table';
const PAGE_SIZE = 10;
const modes = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Credit'];
let lineKey = 0;
const newLine = () => ({ key: ++lineKey, productId: '', qty: '1', price: '', discount: '0' });
function NewSaleModal({ onClose }) {
  const { products, customers, addSale } = useData();
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [lines, setLines] = useState([newLine()]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(null);
  const onCustomerCreated = (c) => setCustomerId(c.id);
  // Put the new product into the first empty line, or a new line.
  const onProductCreated = (p) =>
    setLines((ls) => {
      const filled = { productId: p.id, price: String(p.sellingPrice) };
      const empty = ls.find((l) => !l.productId);
      return empty ? ls.map((l) => (l === empty ? { ...l, ...filled } : l)) : [...ls, { ...newLine(), ...filled }];
    });
  const updateLine = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const onProductChange = (key, productId) => {
    const p = products.find((x) => x.id === productId);
    updateLine(key, { productId, price: p ? String(p.sellingPrice) : '' });
  };
  const items = lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, qty: Number(l.qty) || 0, price: Number(l.price) || 0, discount: Number(l.discount) || 0 }));
  const totals = saleTotals(items);
  const submit = async () => {
    const e = {};
    if (!customerId) e.customerId = 'Choose a customer';
    if (!date) e.date = 'Date is required';
    if (items.length === 0) e.items = 'Add at least one product';
    else if (items.some((i) => i.qty <= 0 || i.price <= 0)) e.items = 'Every line needs a quantity and price above 0';
    else if (items.some((i) => i.discount < 0 || i.discount > 100)) e.items = 'Discount must be between 0 and 100%';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const sale = await addSale({ date, customerId, items, ...totals, paymentMode });
      onClose();
      navigate(`/sales/${sale.id}`);
    } catch {
      // DataContext already shows the server error; keep the form open.
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      size="xl"
      title="New Sale"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving...' : 'Create Invoice'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Select
            label="Customer"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            error={errors.customerId}
            placeholder="Select customer"
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
          />
          <button type="button" onClick={() => setCreating('customer')} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
            <Plus size={12} /> New customer
          </button>
        </div>
        <Input label="Date" type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
        <Select label="Payment mode" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} options={modes.map((m) => ({ value: m, label: m }))} />
      </div>

      <h4 className="mb-2 mt-6 text-sm font-semibold text-slate-900">Line items</h4>
      <div className="space-y-3">
        {lines.map((l) => {
          const total = saleLineTotal({ productId: l.productId, qty: Number(l.qty) || 0, price: Number(l.price) || 0, discount: Number(l.discount) || 0 });
          return (
            <div key={l.key} className="grid grid-cols-2 items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-12">
              <div className="col-span-2 sm:col-span-4">
                <Select
                  label="Product"
                  value={l.productId}
                  onChange={(e) => onProductChange(l.key, e.target.value)}
                  placeholder="Select product"
                  options={products.filter((p) => p.kind !== 'purchase').map((p) => ({ value: p.id, label: p.name }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Input label="Qty" type="number" min="1" value={l.qty} onChange={(e) => updateLine(l.key, { qty: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Input label="Price (₹)" type="number" min="0" step="0.01" value={l.price} onChange={(e) => updateLine(l.key, { price: e.target.value })} />
              </div>
              <div className="sm:col-span-1">
                <Input label="Disc %" type="number" min="0" max="100" value={l.discount} onChange={(e) => updateLine(l.key, { discount: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-slate-600">Line total</span>
                <div className="py-2 text-sm font-semibold text-slate-900">{formatINR2(total)}</div>
              </div>
              <div className="flex justify-end sm:col-span-1">
                <Button variant="ghost" size="sm" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remove line">
                  <Trash2 size={16} className="text-red-500" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {errors.items && <p className="mt-2 text-xs text-red-600">{errors.items}</p>}
      <Button variant="secondary" size="sm" className="mt-3" onClick={() => setLines((ls) => [...ls, newLine()])}>
        <Plus size={14} /> Add line
      </Button>
      <Button variant="ghost" size="sm" className="ml-2 mt-3 text-indigo-600" onClick={() => setCreating('product')}>
        <Plus size={14} /> New product
      </Button>

      <div className="ml-auto mt-6 w-full max-w-xs space-y-2 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal</span>
          <span>{formatINR2(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Discount</span>
          <span>- {formatINR2(totals.discount)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
          <span>Total</span>
          <span>{formatINR2(totals.total)}</span>
        </div>
      </div>

      {creating === 'customer' && <ContactFormModal kind="buyer" onClose={() => setCreating(null)} onSaved={onCustomerCreated} />}
      {creating === 'product' && <ProductFormModal product={null} defaultKind="selling" onClose={() => setCreating(null)} onSaved={onProductCreated} />}
    </Modal>
  );
}
export default function Sales() {
  const { sales, customers, loading, deleteSale } = useData();
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const customerName = (id) => customers.find((c) => c.id === id)?.name ?? 'Walk-in';
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => !q || s.invoiceNo.toLowerCase().includes(q) || customerName(s.customerId).toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, customers, search]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  return (
    <>
      <PageHeader
        title="Sales"
        subtitle="Invoices and payments"
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> New Sale
          </Button>
        }
      />

      <Card padded={false}>
        <div className="border-b border-slate-100 p-4 sm:max-w-sm">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search invoice or customer"
          />
        </div>
        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState title="No sales found" description="Create a new sale to generate an invoice." />
        ) : (
          <Table>
            <THead>
              <Th>Customer</Th>
              <Th className="hidden sm:table-cell">Invoice</Th>
              <Th className="hidden sm:table-cell">Date</Th>
              <Th className="hidden sm:table-cell">Items</Th>
              <Th>Total</Th>
              <Th className="hidden sm:table-cell">Payment</Th>
              <Th className="text-right"><span className="sr-only sm:not-sr-only">Actions</span></Th>
            </THead>
            <TBody>
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <Td className="font-medium text-slate-900">
                    {customerName(s.customerId)}
                    <Link to={`/sales/${s.id}`} className="block text-xs font-medium text-indigo-600 sm:hidden">
                      {s.invoiceNo}
                    </Link>
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <Link to={`/sales/${s.id}`} className="font-medium text-indigo-600 hover:underline">
                      {s.invoiceNo}
                    </Link>
                  </Td>
                  <Td className="hidden sm:table-cell">{formatDate(s.date)}</Td>
                  <Td className="hidden sm:table-cell">{s.items.length}</Td>
                  <Td className="font-medium text-slate-900">{formatINR(s.total)}</Td>
                  <Td className="hidden sm:table-cell">{s.paymentMode}</Td>
                  <Td className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(s)} aria-label={`Delete ${s.invoiceNo}`}>
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
        <Pagination page={currentPage} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </Card>

      {creating && <NewSaleModal onClose={() => setCreating(false)} />}
      <ConfirmDialog
        open={!!deleting}
        title="Delete sale"
        message={deleting ? `Delete invoice ${deleting.invoiceNo}? This cannot be undone.` : ''}
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await deleteSale(deleting.id);
            setDeleting(null);
          } catch {
            // DataContext already shows the server error.
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
