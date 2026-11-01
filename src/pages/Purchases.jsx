import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { purchaseLineTotal, purchaseTotals } from '../utils/calc';
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
const taxRates = [0, 5, 12, 18];
let lineKey = 0;
const newLine = () => ({ key: ++lineKey, productId: '', qty: '1', unitCost: '' });
function NewPurchaseModal({ onClose }) {
  const { products, sellers, addPurchase } = useData();
  const [supplier, setSupplier] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [date, setDate] = useState(todayISO());
  const [taxRate, setTaxRate] = useState(0);
  const [lines, setLines] = useState([newLine()]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(null);
  const onSellerCreated = (s) => setSupplier(s.name);
  // Put the new product into the first empty line, or a new line.
  const onProductCreated = (p) =>
    setLines((ls) => {
      const filled = { productId: p.id, unitCost: String(p.costPrice) };
      const empty = ls.find((l) => !l.productId);
      return empty ? ls.map((l) => (l === empty ? { ...l, ...filled } : l)) : [...ls, { ...newLine(), ...filled }];
    });
  const updateLine = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const onProductChange = (key, productId) => {
    const p = products.find((x) => x.id === productId);
    updateLine(key, { productId, unitCost: p ? String(p.costPrice) : '' });
  };
  const items = lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, qty: Number(l.qty) || 0, unitCost: Number(l.unitCost) || 0 }));
  const totals = purchaseTotals(items, taxRate);
  const submit = async () => {
    const e = {};
    if (!supplier.trim()) e.supplier = 'Choose a seller or create a new one';
    if (!invoiceNo.trim()) e.invoiceNo = 'Invoice no. is required';
    if (!date) e.date = 'Date is required';
    if (items.length === 0) e.items = 'Add at least one product';
    else if (items.some((i) => i.qty <= 0 || i.unitCost <= 0)) e.items = 'Every line needs a quantity and unit cost above 0';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await addPurchase({ date, supplier: supplier.trim(), invoiceNo: invoiceNo.trim(), items, taxRate, ...totals });
      onClose();
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
      title="New Purchase"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving...' : 'Save Purchase'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Select
            label="Seller (supplier)"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            error={errors.supplier}
            placeholder="Select seller"
            options={sellers.map((s) => ({ value: s.name, label: s.name }))}
          />
          <button type="button" onClick={() => setCreating('seller')} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
            <Plus size={12} /> New seller
          </button>
        </div>
        <Input label="Supplier invoice no." value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} error={errors.invoiceNo} />
        <Input label="Date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} error={errors.date} />
      </div>

      <h4 className="mb-2 mt-6 text-sm font-semibold text-slate-900">Line items</h4>
      <div className="space-y-3">
        {lines.map((l) => {
          const total = purchaseLineTotal({ qty: Number(l.qty) || 0, unitCost: Number(l.unitCost) || 0 });
          return (
            <div key={l.key} className="grid grid-cols-2 items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-12">
              <div className="col-span-2 sm:col-span-5">
                <Select
                  label="Product"
                  value={l.productId}
                  onChange={(e) => onProductChange(l.key, e.target.value)}
                  placeholder="Select product"
                  options={products.filter((p) => p.kind !== 'selling').map((p) => ({ value: p.id, label: p.name }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Input label="Qty" type="number" min="1" value={l.qty} onChange={(e) => updateLine(l.key, { qty: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Input label="Unit cost (₹)" type="number" min="0" step="0.01" value={l.unitCost} onChange={(e) => updateLine(l.key, { unitCost: e.target.value })} />
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
        <div className="flex items-center justify-between text-slate-600">
          <span className="flex items-center gap-2">
            Tax
            <select value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="rounded border border-slate-300 px-1 py-0.5 text-xs">
              {taxRates.map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </select>
          </span>
          <span>{formatINR2(totals.tax)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
          <span>Grand total</span>
          <span>{formatINR2(totals.total)}</span>
        </div>
      </div>

      {creating === 'seller' && <ContactFormModal kind="seller" onClose={() => setCreating(null)} onSaved={onSellerCreated} />}
      {creating === 'product' && <ProductFormModal product={null} defaultKind="purchase" onClose={() => setCreating(null)} onSaved={onProductCreated} />}
    </Modal>
  );
}
export default function Purchases() {
  const { purchases, products, loading, deletePurchase } = useData();
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [creating, setCreating] = useState(false);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return purchases.filter((p) => !q || p.supplier.toLowerCase().includes(q) || p.invoiceNo.toLowerCase().includes(q));
  }, [purchases, search]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const productName = (id) => products.find((p) => p.id === id)?.name ?? 'Unknown product';
  return (
    <>
      <PageHeader
        title="Purchases"
        subtitle="Record what you buy from your sellers"
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> New Purchase
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
            placeholder="Search supplier or invoice"
          />
        </div>
        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState title="No purchases found" description="Record a new purchase." />
        ) : (
          <Table>
            <THead>
              <Th className="w-8" />
              <Th>Supplier</Th>
              <Th className="hidden sm:table-cell">Date</Th>
              <Th className="hidden sm:table-cell">Items</Th>
              <Th>Total</Th>
              <Th className="text-right"><span className="sr-only sm:not-sr-only">Actions</span></Th>
            </THead>
            <TBody>
              {rows.map((p) => {
                const open = expanded === p.id;
                return (
                  <Fragment key={p.id}>
                    <tr className="cursor-pointer hover:bg-slate-50/60" onClick={() => setExpanded(open ? null : p.id)}>
                      <Td>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</Td>
                      <Td className="font-medium text-slate-900">{p.supplier}</Td>
                      <Td className="hidden sm:table-cell">{formatDate(p.date)}</Td>
                      <Td className="hidden sm:table-cell">{p.items.length}</Td>
                      <Td className="font-medium text-slate-900">{formatINR(p.total)}</Td>
                      <Td className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleting(p);
                          }}
                          aria-label={`Delete purchase ${p.invoiceNo}`}
                        >
                          <Trash2 size={14} className="text-red-500" />
                        </Button>
                      </Td>
                    </tr>
                    {open && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={7} className="px-4 py-4 sm:px-12">
                          <p className="mb-2 text-xs text-slate-500">
                            Supplier invoice <span className="font-medium text-slate-700">{p.invoiceNo}</span> - tax {p.taxRate}%
                          </p>
                          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                            <table className="min-w-full text-sm">
                              <thead className="text-xs uppercase text-slate-500">
                                <tr>
                                  <th className="px-3 py-2 text-left">Product</th>
                                  <th className="px-3 py-2 text-right">Qty</th>
                                  <th className="px-3 py-2 text-right">Unit cost</th>
                                  <th className="px-3 py-2 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {p.items.map((i, idx) => (
                                  <tr key={idx}>
                                    <td className="px-3 py-2">{productName(i.productId)}</td>
                                    <td className="px-3 py-2 text-right">{i.qty}</td>
                                    <td className="px-3 py-2 text-right">{formatINR2(i.unitCost)}</td>
                                    <td className="px-3 py-2 text-right">{formatINR2(purchaseLineTotal(i))}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="text-sm">
                                <tr>
                                  <td colSpan={3} className="px-3 py-1 text-right text-slate-500">
                                    Subtotal
                                  </td>
                                  <td className="px-3 py-1 text-right">{formatINR2(p.subtotal)}</td>
                                </tr>
                                <tr>
                                  <td colSpan={3} className="px-3 py-1 text-right text-slate-500">
                                    Tax ({p.taxRate}%)
                                  </td>
                                  <td className="px-3 py-1 text-right">{formatINR2(p.tax)}</td>
                                </tr>
                                <tr>
                                  <td colSpan={3} className="px-3 py-2 text-right font-semibold">
                                    Grand total
                                  </td>
                                  <td className="px-3 py-2 text-right font-semibold">{formatINR2(p.total)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </TBody>
          </Table>
        )}
        <Pagination page={currentPage} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </Card>

      {creating && <NewPurchaseModal onClose={() => setCreating(false)} />}
      <ConfirmDialog
        open={!!deleting}
        title="Delete purchase"
        message={deleting ? `Delete purchase ${deleting.invoiceNo} from ${deleting.supplier}? This cannot be undone.` : ''}
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await deletePurchase(deleting.id);
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
