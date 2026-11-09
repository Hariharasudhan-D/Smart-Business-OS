import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Pencil, Phone, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { customerStats } from '../utils/customerStats';
import { formatDate, formatINR } from '../utils/format';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { ContactFormModal } from './Contacts';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import SearchInput from '../components/ui/SearchInput';
import { Skeleton } from '../components/ui/Skeleton';
export default function Customers() {
  const { customers, sales, loading, deleteCustomer } = useData();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q))
      .map((c) => ({ customer: c, stats: customerStats(c.id, sales) }));
  }, [customers, sales, search]);
  return (
    <>
      <PageHeader
        title="Buyers"
        subtitle={`${customers.length} ${customers.length === 1 ? 'buyer' : 'buyers'} - add new ones in Add Customers`}
      />

      <div className="mb-4 sm:max-w-sm">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, phone or email" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title="No buyers found" description="Add a customer with type Buyer in Add Customers." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ customer: c, stats }) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                    {c.name
                      .split(' ')
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                  <div className="min-w-0">
                    <Link to={`/customers/${c.id}`} className="block truncate font-semibold text-slate-900 hover:text-indigo-600">
                      {c.name}
                    </Link>
                  </div>
                </div>
                <div className="flex shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(c)} aria-label={`Delete ${c.name}`}>
                    <Trash2 size={14} className="text-red-500" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600 [overflow-wrap:anywhere]">
                <div className="flex items-start gap-2">
                  <Phone size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  {c.phone}
                </div>
                <div className="flex items-start gap-2">
                  <Mail size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  {c.email || '-'}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center [&>div]:min-w-0 [&_.text-base]:text-sm sm:[&_.text-base]:text-base">
                <div>
                  <div className="text-base font-semibold text-slate-900">{stats.totalOrders}</div>
                  <div className="text-xs text-slate-500">Orders</div>
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-900">{formatINR(stats.totalSpent)}</div>
                  <div className="text-xs text-slate-500">Spent</div>
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-900">{stats.lastPurchase ? formatDate(stats.lastPurchase) : '-'}</div>
                  <div className="text-xs text-slate-500">Last purchase</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <ContactFormModal contact={editing} kind="buyer" onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title="Delete buyer"
        message={deleting ? `Delete ${deleting.name}? Buyers who already have sales cannot be deleted. This cannot be undone.` : ''}
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await deleteCustomer(deleting.id);
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
