import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { formatINR } from '../utils/format';
import Badge from '../components/ui/Badge';
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
import { TableSkeleton } from '../components/ui/Skeleton';
import { Table, TBody, Td, Th, THead } from '../components/ui/Table';
const PAGE_SIZE = 10;
const units = ['pcs', 'kg', 'ltr', 'pack', 'box'];
const emptyForm = { name: '', costPrice: '', sellingPrice: '', unit: 'pcs', kind: '' };
function ProductImage({ product }) {
  const [failed, setFailed] = useState(false);
  if (failed || !product.image) {
    return <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-sm font-semibold text-indigo-600">{product.name.charAt(0)}</div>;
  }
  return <img src={product.image} alt="" onError={() => setFailed(true)} className="h-10 w-10 rounded-lg object-cover" />;
}
// onSaved receives the new product, so the sale / purchase forms can create one inline and select it.
export function ProductFormModal({ product, onClose, onSaved, defaultKind }) {
  const { products, addProduct, updateProduct } = useData();
  const [form, setForm] = useState(
    product
      ? {
          name: product.name,
          costPrice: String(product.costPrice),
          sellingPrice: String(product.sellingPrice),
          unit: product.unit,
          kind: product.kind,
        }
      : { ...emptyForm, kind: defaultKind ?? '' },
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // Purchase-only products are never sold, so they have no selling price.
  // Selling products carry no prices (the price is typed on each sale); purchase products have a cost, 'both' has cost and selling price.
  const hasCost = form.kind === 'purchase' || form.kind === 'both';
  const hasSelling = form.kind === 'both';
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.kind) e.kind = 'Choose whether this is a selling or purchase product';
    const num = (k, min) => {
      const v = Number(form[k]);
      if (form[k] === '' || Number.isNaN(v)) e[k] = 'Required';
      else if (v < min) e[k] = min > 0 ? 'Must be greater than 0' : 'Cannot be negative';
    };
    if (hasCost) num('costPrice', 0.01);
    if (hasSelling) num('sellingPrice', 0.01);
    if (hasSelling && !e.costPrice && !e.sellingPrice && Number(form.sellingPrice) < Number(form.costPrice)) e.sellingPrice = 'Selling price is below cost';
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        costPrice: hasCost ? Number(form.costPrice) : 0,
        sellingPrice: hasSelling ? Number(form.sellingPrice) : 0,
        unit: form.unit,
        kind: form.kind,
      };
      if (product) await updateProduct(product.id, data);
      else {
        const created = await addProduct({ ...data, image: '' });
        onSaved?.(created);
      }
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
      title={product ? 'Edit Product' : 'Add Product'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving...' : 'Save Product'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label="Product name" value={form.name} onChange={set('name')} error={errors.name} />
        </div>
        <div className="sm:col-span-2">
          <Select
            label="Product type"
            value={form.kind}
            onChange={set('kind')}
            error={errors.kind}
            placeholder="Select type"
            options={[
              { value: 'selling', label: 'Selling product - sold to buyers' },
              { value: 'purchase', label: 'Purchase product - bought from sellers' },
              { value: 'both', label: 'Both - bought from sellers and sold to buyers' },
            ]}
          />
        </div>
        {hasCost && <Input label="Cost price (₹)" type="number" min="0" step="0.01" value={form.costPrice} onChange={set('costPrice')} error={errors.costPrice} />}
        {hasSelling && <Input label="Selling price (₹)" type="number" min="0" step="0.01" value={form.sellingPrice} onChange={set('sellingPrice')} error={errors.sellingPrice} />}
        <Select label="Unit" value={form.unit} onChange={set('unit')} options={units.map((u) => ({ value: u, label: u }))} />
      </div>
    </Modal>
  );
}
export default function Products({ mode }) {
  const priceKey = 'costPrice';
  const priceText = (p) => (p.kind === 'selling' ? '-' : p.kind === 'purchase' ? formatINR(p.costPrice) : `${formatINR(p.costPrice)} / ${formatINR(p.sellingPrice)}`);
  const manage = mode === 'manage';
  const { products, loading, deleteProduct } = useData();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState(null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = products.filter(
      (p) =>
        (mode === 'manage' || (mode === 'selling' ? p.kind !== 'purchase' : p.kind !== 'selling')) &&
        (!q || p.name.toLowerCase().includes(q)),
    );
    if (sort) rows = [...rows].sort((a, b) => (a[sort.key] - b[sort.key]) * (sort.dir === 'asc' ? 1 : -1));
    return rows;
  }, [products, search, sort, mode]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const toggleSort = (key) => setSort((s) => (s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));
  const SortHeader = ({ k, label }) => (
    <Th>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase hover:text-slate-800">
        {label}
        {sort?.key === k && (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </Th>
  );
  const resetPage = (setter) => (v) => {
    setter(v);
    setPage(1);
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteProduct(deleting.id);
      setDeleting(null);
    } catch {
      // DataContext already shows the server error.
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        title={manage ? 'Add Products' : mode === 'selling' ? 'Selling Products' : 'Purchase Products'}
        subtitle={
          manage
            ? 'Create and maintain your product catalogue'
            : mode === 'selling'
              ? 'Items you sell. Add new products in Add Products'
              : 'Items you buy, with cost price. Add new products in Add Products'
        }
        action={
          manage ? (
            <Button onClick={() => setEditing('new')}>
              <Plus size={16} /> Add Product
            </Button>
          ) : undefined
        }
      />

      <Card padded={false}>
        <div className="border-b border-slate-100 p-4 sm:max-w-sm">
          <SearchInput value={search} onChange={resetPage(setSearch)} placeholder="Search products" />
        </div>

        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState title="No products found" description="Try changing your search or filters, or add a new product." />
        ) : (
          <Table>
            <THead>
              <Th>Product</Th>
              {manage && <Th className="hidden sm:table-cell">Type</Th>}
              {mode === 'purchase' && <SortHeader k={priceKey} label="Cost price" />}
              {manage && <Th>Cost / selling price</Th>}
              <Th className="hidden sm:table-cell">Unit</Th>
              <Th className="text-right"><span className="sr-only sm:not-sr-only">Actions</span></Th>
            </THead>
            <TBody>
              {rows.map((p) => {
                return (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <Td>
                      <div className="flex items-center gap-3">
                        <ProductImage product={p} />
                        <div className="min-w-0">
                          <span className="block font-medium text-slate-900">{p.name}</span>
                          {manage && (
                            <span className="mt-0.5 block text-xs text-slate-500 sm:hidden">
                              {p.kind === 'both' ? 'Selling + Purchase' : p.kind === 'selling' ? 'Selling' : 'Purchase'}
                            </span>
                          )}
                        </div>
                      </div>
                    </Td>
                    {manage && (
                      <Td className="hidden sm:table-cell">
                        <Badge tone={p.kind === 'both' ? 'indigo' : p.kind === 'selling' ? 'green' : 'amber'}>
                          {p.kind === 'both' ? 'Selling + Purchase' : p.kind === 'selling' ? 'Selling' : 'Purchase'}
                        </Badge>
                      </Td>
                    )}
                    {mode === 'purchase' && <Td>{formatINR(p.costPrice)}</Td>}
                    {manage && <Td>{priceText(p)}</Td>}
                    <Td className="hidden sm:table-cell">{p.unit}</Td>
                    <Td className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(p)} aria-label={`Delete ${p.name}`}>
                        <Trash2 size={14} className="text-red-500" />
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </TBody>
          </Table>
        )}
        <Pagination page={currentPage} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </Card>

      {editing && <ProductFormModal product={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title="Delete product"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
