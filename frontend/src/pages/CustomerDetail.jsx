import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, MapPin, Pencil, Phone } from 'lucide-react';
import { useData } from '../context/DataContext';
import { customerStats } from '../utils/customerStats';
import { formatDate, formatINR } from '../utils/format';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { Table, TBody, Td, Th, THead } from '../components/ui/Table';
import { ContactFormModal } from './Contacts';
export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { customers, sales, loading } = useData();
  const [editing, setEditing] = useState(false);
  if (loading) return <Skeleton className="h-64" />;
  const customer = customers.find((c) => c.id === id);
  if (!customer) {
    return (
      <Card>
        <EmptyState title="Customer not found" action={<Button onClick={() => navigate('/customers/buyers')}>Back to buyers</Button>} />
      </Card>
    );
  }
  const stats = customerStats(customer.id, sales);
  const history = sales.filter((s) => s.customerId === customer.id);
  return (
    <>
      <Link to="/customers/buyers" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> All buyers
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-base font-semibold text-indigo-700">
                {customer.name
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')}
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">{customer.name}</h1>
                <p className="text-xs text-slate-500">Buyer</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Edit
            </Button>
          </div>
          <div className="mt-5 space-y-2.5 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-slate-400" />
              {customer.phone}
            </div>
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-slate-400" />
              {customer.email || '-'}
            </div>
            <div className="flex items-start gap-2">
              <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
              {customer.address || '-'}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
            <div>
              <div className="font-semibold text-slate-900">{stats.totalOrders}</div>
              <div className="text-xs text-slate-500">Orders</div>
            </div>
            <div>
              <div className="font-semibold text-slate-900">{formatINR(stats.totalSpent)}</div>
              <div className="text-xs text-slate-500">Spent</div>
            </div>
            <div>
              <div className="font-semibold text-slate-900">{stats.lastPurchase ? formatDate(stats.lastPurchase) : '-'}</div>
              <div className="text-xs text-slate-500">Last</div>
            </div>
          </div>
        </Card>

        <Card title="Sales history" padded={false} className="lg:col-span-2">
          {history.length === 0 ? (
            <EmptyState title="No purchases yet" description="Sales made to this customer will show up here." />
          ) : (
            <Table>
              <THead>
                <Th>Invoice</Th>
                <Th>Date</Th>
                <Th>Items</Th>
                <Th>Total</Th>
                <Th>Payment</Th>
              </THead>
              <TBody>
                {history.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <Td>
                      <Link to={`/sales/${s.id}`} className="font-medium text-indigo-600 hover:underline">
                        {s.invoiceNo}
                      </Link>
                    </Td>
                    <Td>{formatDate(s.date)}</Td>
                    <Td>{s.items.length}</Td>
                    <Td className="font-medium text-slate-900">{formatINR(s.total)}</Td>
                    <Td>{s.paymentMode}</Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>

      {editing && <ContactFormModal contact={customer} kind="buyer" onClose={() => setEditing(false)} />}
    </>
  );
}
