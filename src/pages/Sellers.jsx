import { useMemo, useState } from 'react';
import { Mail, MapPin, Pencil, Phone, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { formatDate, formatINR } from '../utils/format';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { ContactFormModal } from './Contacts';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import SearchInput from '../components/ui/SearchInput';
import { Skeleton } from '../components/ui/Skeleton';
export default function Sellers() {
  const { sellers, purchases, loading, deleteSeller } = useData();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  // Purchase stats are matched to a seller by name.
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sellers
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.phone.includes(q) || s.email.toLowerCase().includes(q))
      .map((seller) => {
        const mine = purchases.filter((p) => p.supplier === seller.name);
        return {
          seller,
          orders: mine.length,
          spent: mine.reduce((sum, p) => sum + p.total, 0),
          last: mine.reduce((l, p) => (!l || p.date > l ? p.date : l), null),
        };
      });
  }, [sellers, purchases, search]);
  return (
    <>
      <PageHeader
        title="Sellers"
        subtitle={`${sellers.length} ${sellers.length === 1 ? 'supplier' : 'suppliers'} you buy from - add new ones in Add Customers`}
      />
      <div className="mb-4 sm:max-w-sm">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, phone or email" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title="No sellers found" description="Add a customer with type Seller in Add Customers." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ seller: s, orders, spent, last }) => (
            <Card key={s.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">
                    {s.name
                      .split(' ')
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.gstin ? `GSTIN ${s.gstin}` : 'No GSTIN'}</p>
                  </div>
                </div>
                <div className="flex shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(s)} aria-label={`Delete ${s.name}`}>
                    <Trash2 size={14} className="text-red-500" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600 [overflow-wrap:anywhere]">
                <div className="flex items-start gap-2">
                  <Phone size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  {s.phone}
                </div>
                <div className="flex items-start gap-2">
                  <Mail size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  {s.email || '-'}
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  {s.address || '-'}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center [&>div]:min-w-0 [&_.text-base]:text-sm sm:[&_.text-base]:text-base">
                <div>
                  <div className="text-base font-semibold text-slate-900">{orders}</div>
                  <div className="text-xs text-slate-500">Purchases</div>
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-900">{formatINR(spent)}</div>
                  <div className="text-xs text-slate-500">Total bought</div>
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-900">{last ? formatDate(last) : '-'}</div>
                  <div className="text-xs text-slate-500">Last purchase</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && <ContactFormModal contact={editing} kind="seller" onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title="Delete seller"
        message={deleting ? `Delete ${deleting.name}? Their past purchases are kept. This cannot be undone.` : ''}
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await deleteSeller(deleting.id);
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
