import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import PageHeader from '../components/ui/PageHeader';
import SearchInput from '../components/ui/SearchInput';
import Select from '../components/ui/Select';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Table, TBody, Td, Th, THead } from '../components/ui/Table';

const kindOptions = [
  { value: 'buyer', label: 'Buyer - buys from you' },
  { value: 'seller', label: 'Seller - you buy from them' },
];

// Buyers are stored as customers, sellers as sellers; `kind` picks which one.
// Pass `kind` to lock the type (inline create in Sales / Purchases, or editing).
export function ContactFormModal({ contact, kind: fixedKind, onClose, onSaved }) {
  const { sellers, addCustomer, updateCustomer, addSeller, updateSeller } = useData();
  const [kind, setKind] = useState(fixedKind ?? '');
  const [form, setForm] = useState({
    name: contact?.name ?? '',
    phone: contact?.phone ?? '',
    email: contact?.email ?? '',
    address: contact?.address ?? '',
    gstin: contact?.gstin ?? '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isSeller = kind === 'seller';

  const submit = async () => {
    const e = {};
    const name = form.name.trim();
    if (!kind) e.kind = 'Choose Buyer or Seller';
    if (!name) e.name = 'Name is required';
    // Purchases are linked to sellers by name, so seller names must be unique.
    else if (isSeller && sellers.some((s) => s.name.toLowerCase() === name.toLowerCase() && s.id !== contact?.id)) e.name = 'A seller with this name already exists';
    if (!/^\+?[0-9 ]{10,15}$/.test(form.phone.trim())) e.phone = 'Enter a valid phone number';
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Enter a valid email';
    if (isSeller && form.gstin.trim() && !/^[0-9A-Z]{15}$/i.test(form.gstin.trim())) e.gstin = 'GSTIN must be 15 characters';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      const data = { name, phone: form.phone.trim(), email: form.email.trim(), address: form.address.trim() };
      if (isSeller) data.gstin = form.gstin.trim().toUpperCase();
      const add = isSeller ? addSeller : addCustomer;
      const update = isSeller ? updateSeller : updateCustomer;
      if (contact) await update(contact.id, data);
      else {
        const created = await add(data);
        onSaved?.(created);
      }
      onClose();
    } catch {
      // DataContext already shows the server error; keep the form open.
    } finally {
      setSaving(false);
    }
  };

  const noun = kind === 'seller' ? 'Seller' : kind === 'buyer' ? 'Buyer' : 'Customer';
  return (
    <Modal
      open
      title={`${contact ? 'Edit' : 'Add'} ${noun}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving...' : `Save ${noun}`}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label={isSeller ? 'Seller / company name' : 'Full name'} value={form.name} onChange={set('name')} error={errors.name} />
        </div>
        {!fixedKind && (
          <div className="sm:col-span-2">
            <Select label="Customer type" value={kind} onChange={(e) => setKind(e.target.value)} placeholder="Choose buyer or seller" options={kindOptions} error={errors.kind} />
          </div>
        )}
        <Input label="Phone" value={form.phone} onChange={set('phone')} error={errors.phone} placeholder="+91 98765 43210" />
        <Input label="Email (optional)" type="email" value={form.email} onChange={set('email')} error={errors.email} />
        {isSeller && <Input label="GSTIN (optional)" value={form.gstin} onChange={set('gstin')} error={errors.gstin} />}
        <div className="sm:col-span-2">
          <Input label="Address" value={form.address} onChange={set('address')} />
        </div>
      </div>
    </Modal>
  );
}

export default function Contacts() {
  const { customers, sellers, loading, deleteCustomer, deleteSeller } = useData();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // 'new' | { contact, kind }
  const [deleting, setDeleting] = useState(null); // { contact, kind }
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...customers.map((c) => ({ contact: c, kind: 'buyer' })), ...sellers.map((s) => ({ contact: s, kind: 'seller' }))]
      .filter(({ contact: c }) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q))
      .sort((a, b) => a.contact.name.localeCompare(b.contact.name));
  }, [customers, sellers, search]);

  return (
    <>
      <PageHeader
        title="Add Customers"
        subtitle="Add buyers and sellers here; they appear under Buyers or Sellers by their type"
        action={
          <Button onClick={() => setEditing('new')}>
            <Plus size={16} /> Add Customer
          </Button>
        }
      />

      <Card padded={false}>
        <div className="border-b border-slate-100 p-4 sm:max-w-sm">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, phone or email" />
        </div>
        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState title="No customers yet" description="Add a buyer or a seller to get started." />
        ) : (
          <Table>
            <THead>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th className="hidden sm:table-cell">Phone</Th>
              <Th className="hidden sm:table-cell">Email</Th>
              <Th className="hidden sm:table-cell">GSTIN</Th>
              <Th className="text-right"><span className="sr-only sm:not-sr-only">Actions</span></Th>
            </THead>
            <TBody>
              {rows.map(({ contact: c, kind }) => (
                <tr key={`${kind}-${c.id}`} className="hover:bg-slate-50/60">
                  <Td className="font-medium text-slate-900">
                    {c.name}
                    <span className="block text-xs font-normal text-slate-500 sm:hidden">{c.phone}</span>
                  </Td>
                  <Td>
                    <Badge tone={kind === 'buyer' ? 'green' : 'amber'}>{kind === 'buyer' ? 'Buyer' : 'Seller'}</Badge>
                  </Td>
                  <Td className="hidden sm:table-cell">{c.phone}</Td>
                  <Td className="hidden sm:table-cell">{c.email || '-'}</Td>
                  <Td className="hidden sm:table-cell font-mono text-xs">{kind === 'seller' ? c.gstin || '-' : '-'}</Td>
                  <Td className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing({ contact: c, kind })} aria-label={`Edit ${c.name}`}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting({ contact: c, kind })} aria-label={`Delete ${c.name}`}>
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                  </Td>
                </tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {editing === 'new' && <ContactFormModal onClose={() => setEditing(null)} />}
      {editing && editing !== 'new' && <ContactFormModal contact={editing.contact} kind={editing.kind} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title={deleting?.kind === 'seller' ? 'Delete seller' : 'Delete buyer'}
        message={
          deleting
            ? `Delete ${deleting.contact.name}? ${deleting.kind === 'buyer' ? 'Buyers who already have sales cannot be deleted.' : 'Their past purchases are kept.'} This cannot be undone.`
            : ''
        }
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await (deleting.kind === 'seller' ? deleteSeller : deleteCustomer)(deleting.contact.id);
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
