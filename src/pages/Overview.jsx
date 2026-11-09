import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Bike, IndianRupee, TrendingDown, TrendingUp, Truck } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useData } from '../context/DataContext';
import { reportApi } from '../api/report';
import { saleLineTotal } from '../utils/calc';
import { formatDate, formatINR, monthKey, todayISO } from '../utils/format';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import { Skeleton } from '../components/ui/Skeleton';
const SALES_COLOR = '#4f46e5';
const PURCHASE_COLOR = '#f4511e';
const SLICE_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const shortDate = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const periodOptions = [
  { value: 'last12', label: 'Last 12 months' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'thisYear', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
];

// [from, to] for a preset, never going past today.
function presetRange(preset, today) {
  const y = today.getFullYear();
  const m = today.getMonth();
  const ranges = {
    last12: [new Date(y, m - 11, 1), today],
    thisMonth: [new Date(y, m, 1), today],
    lastMonth: [new Date(y, m - 1, 1), new Date(y, m, 0)],
    thisYear: [new Date(y, 0, 1), today],
  };
  return ranges[preset];
}

const trimZero = (n) => String(Number(n.toFixed(1)));
const compactINR = (n) => (n >= 100000 ? `₹${trimZero(n / 100000)}L` : n >= 1000 ? `₹${trimZero(n / 1000)}k` : `₹${n}`);
// % change of the last 3 months versus the 3 months before that.
function trend(series) {
  const recent = series.slice(-3).reduce((a, b) => a + b, 0);
  const before = series.slice(-6, -3).reduce((a, b) => a + b, 0);
  return before === 0 ? null : ((recent - before) / before) * 100;
}
function Trend({ value, goodWhenUp = true }) {
  if (value === null) return <span className="text-xs text-slate-400">no prior data</span>;
  const up = value >= 0;
  const good = up === goodWhenUp;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${good ? 'text-emerald-600' : 'text-red-600'}`}>
      <Icon size={14} /> {Math.abs(value).toFixed(0)}% <span className="font-normal text-slate-400">vs prev. 3 mo</span>
    </span>
  );
}
function Kpi({ label, value, icon: Icon, tone, footer, valueClass = 'text-slate-900' }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${tone}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="mt-3">{footer}</div>
    </Card>
  );
}
export default function Overview() {
  const { sales, purchases, products, customers, loading } = useData();
  const [period, setPeriod] = useState('monthly');
  const [rangePreset, setRangePreset] = useState('last12');
  const [customFrom, setCustomFrom] = useState(() => `${todayISO().slice(0, 8)}01`);
  const [customTo, setCustomTo] = useState(() => todayISO());
  // Sales, purchases and profit come from the server (same numbers as the phone app).
  const [reports, setReports] = useState(null);
  const [reportError, setReportError] = useState('');
  useEffect(() => {
    const now = new Date();
    const first = toISO(new Date(now.getFullYear(), now.getMonth() - 11, 1));
    let alive = true;
    Promise.all([reportApi.get(first, todayISO(), 'month'), reportApi.get(`${now.getFullYear() - 4}-01-01`, todayISO(), 'year')])
      .then(([m, y]) => alive && (setReports({ m, y }), setReportError('')))
      .catch((err) => alive && setReportError(err.message));
    return () => {
      alive = false;
    };
  }, [sales, purchases]);
  const monthLabel = (key) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1).toLocaleString('en-IN', { month: 'short' });
  const toRow = (r, label) => ({ key: r.key, label, sales: Number(r.sales), purchases: Number(r.purchases), profit: Number(r.profit) });
  const months = useMemo(() => (reports ? reports.m.rows.map((r) => toRow(r, monthLabel(r.key))) : []), [reports]);
  const years = useMemo(() => (reports ? reports.y.rows.map((r) => toRow(r, r.key)) : []), [reports]);
  const sumOf = (rows) => rows.reduce((t, r) => ({ sales: t.sales + r.sales, purchases: t.purchases + r.purchases, profit: t.profit + r.profit }), { sales: 0, purchases: 0, profit: 0 });
  const yearTotals = sumOf(months);
  const data = useMemo(() => {
    const qtyByProduct = new Map();
    const nameByKey = new Map();
    const revenueByMode = new Map();
    sales.forEach((s) =>
      s.items.forEach((i) => {
        // website items carry their own cake name instead of an OS product id
        const key = i.productId ?? `name:${i.name}`;
        nameByKey.set(key, products.find((p) => p.id === i.productId)?.name ?? i.name ?? 'Unknown product');
        qtyByProduct.set(key, (qtyByProduct.get(key) ?? 0) + i.qty);
        revenueByMode.set(s.paymentMode, (revenueByMode.get(s.paymentMode) ?? 0) + saleLineTotal(i));
      }),
    );
    const topProducts = [...qtyByProduct.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, qty]) => ({ name: nameByKey.get(key), qty }));
    const categories = [...revenueByMode.entries()].map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
    return { topProducts, categories };
  }, [sales, products]);
  const rangeInput = useMemo(() => {
    const today = parseISO(todayISO());
    let from;
    let to;
    if (rangePreset === 'custom') {
      if (!customFrom || !customTo) return { error: 'Choose both a start and an end date.' };
      from = parseISO(customFrom);
      to = parseISO(customTo);
      if (from > to) return { error: 'The start date must be on or before the end date.' };
    } else {
      [from, to] = presetRange(rangePreset, today);
    }
    const days = Math.round((to - from) / 86400000) + 1;
    return { from, to, daily: days <= 62 };
  }, [rangePreset, customFrom, customTo]);
  const [rangeReport, setRangeReport] = useState(null);
  useEffect(() => {
    if (rangeInput.error) return undefined;
    let alive = true;
    reportApi
      .get(toISO(rangeInput.from), toISO(rangeInput.to), rangeInput.daily ? 'day' : 'month')
      .then((r) => alive && setRangeReport(r))
      .catch(() => alive && setRangeReport(null));
    return () => {
      alive = false;
    };
  }, [rangeInput, sales, purchases]);
  const range = useMemo(() => {
    if (rangeInput.error) return { error: rangeInput.error };
    const { from, to, daily } = rangeInput;
    const crossesYear = from.getFullYear() !== to.getFullYear();
    const rows = (rangeReport?.rows ?? []).map((r) => {
      if (daily) {
        const d = parseISO(r.key);
        return { ...toRow(r, `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'short' })}`), full: shortDate(d) };
      }
      const d = new Date(Number(r.key.slice(0, 4)), Number(r.key.slice(5, 7)) - 1, 1);
      const month = d.toLocaleString('en-IN', { month: 'short' });
      return { ...toRow(r, crossesYear ? `${month} '${String(d.getFullYear()).slice(2)}` : month), full: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) };
    });
    const totals = sumOf(rows);
    return { rows, daily, totals, text: `${shortDate(from)} - ${shortDate(to)}` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeInput, rangeReport]);

  if (loading || (!reports && !reportError)) {
    return (
      <>
        <PageHeader title="Overview" subtitle="Last 12 months" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 lg:col-span-3" />
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </>
    );
  }
  const profit = yearTotals.profit;
  const periodSeries = period === 'monthly' ? months : years;
  const periodTotals = periodSeries.reduce(
    (t, m) => ({ sales: t.sales + m.sales, purchases: t.purchases + m.purchases, profit: t.profit + m.profit }),
    { sales: 0, purchases: 0, profit: 0 },
  );
  const profitSeries = months.map((m) => m.profit);
  const sellerName = (name) => name;
  const customerName = (s) => s.customerName ?? customers.find((c) => c.id === s.customerId)?.name ?? 'Walk-in';
  // Delivery charges are kept apart from sales and profit.
  const delivery = { total: Number(reports?.m.totals.delivery ?? 0), count: reports?.m.totals.deliveries ?? 0 };
  return (
    <>
      <PageHeader title="Overview" subtitle="Business performance over the last 12 months" />
      {reportError && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Could not load the totals: {reportError}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Total sales"
          value={formatINR(yearTotals.sales)}
          icon={IndianRupee}
          tone="bg-indigo-50 text-indigo-600"
          footer={<Trend value={trend(months.map((m) => m.sales))} />}
        />
        <Kpi
          label="Total purchases"
          value={formatINR(yearTotals.purchases)}
          icon={Truck}
          tone="bg-orange-50 text-orange-600"
          footer={<Trend value={trend(months.map((m) => m.purchases))} goodWhenUp={false} />}
        />
        <Kpi
          label={profit >= 0 ? 'Profit (sales - purchases)' : 'Loss (sales - purchases)'}
          value={formatINR(profit)}
          icon={profit >= 0 ? TrendingUp : TrendingDown}
          tone={profit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}
          valueClass={profit >= 0 ? 'text-emerald-600' : 'text-red-600'}
          footer={<Trend value={trend(profitSeries)} />}
        />
        <Kpi
          label="Delivery pays"
          value={formatINR(delivery.total)}
          icon={Bike}
          tone="bg-sky-50 text-sky-600"
          footer={
            <span className="text-xs text-slate-400">
              {delivery.count} home {delivery.count === 1 ? 'delivery' : 'deliveries'} - not counted in sales or profit
            </span>
          }
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Sales vs purchases" className="lg:col-span-3">
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-2xl">
            <Select label="Period" value={rangePreset} onChange={(e) => setRangePreset(e.target.value)} options={periodOptions} />
            {rangePreset === 'custom' && (
              <>
                <Input label="From" type="date" max={todayISO()} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                <Input label="To" type="date" max={todayISO()} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </>
            )}
          </div>
          {range.error ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{range.error}</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-slate-500">
                {range.text} - {range.daily ? 'one point per day' : 'one point per month'}
              </p>
              <div className="mb-4 grid grid-cols-3 gap-3 text-center sm:text-left">
                <div>
                  <p className="text-xs text-slate-500">Sales</p>
                  <p className="text-sm font-semibold text-indigo-600 sm:text-base">{formatINR(range.totals.sales)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Purchases</p>
                  <p className="text-sm font-semibold sm:text-base" style={{ color: PURCHASE_COLOR }}>
                    {formatINR(range.totals.purchases)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Profit</p>
                  <p className={`text-sm font-semibold sm:text-base ${range.totals.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatINR(range.totals.profit)}</p>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={range.rows} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} minTickGap={14} />
                    <YAxis tickFormatter={compactINR} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} width={55} />
                    <Tooltip formatter={(v) => formatINR(v)} labelFormatter={(_, items) => items?.[0]?.payload?.full ?? ''} />
                    <Legend iconType="plainline" />
                    <Line type="monotone" dataKey="sales" name="Sales" stroke={SALES_COLOR} strokeWidth={2.5} dot={{ r: range.daily ? 2 : 3 }} />
                    <Line type="monotone" dataKey="purchases" name="Purchases" stroke={PURCHASE_COLOR} strokeWidth={2.5} dot={{ r: range.daily ? 2 : 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Card>

        <Card title="Top 5 selling products" className="lg:col-span-2">
          {data.topProducts.length === 0 ? (
            <EmptyState title="No sales yet" description="Your best sellers will appear here." />
          ) : (
            <ol className="space-y-4">
              {data.topProducts.map((p, i) => (
                <li key={p.name}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">{i + 1}</span>
                      <span className="truncate font-medium text-slate-800">{p.name}</span>
                    </span>
                    <span className="shrink-0 text-slate-500">
                      <span className="font-semibold text-slate-900">{p.qty}</span> sold
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(4, (p.qty / data.topProducts[0].qty) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Sales by payment mode">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.categories} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {data.categories.map((_, i) => (
                    <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatINR(v)} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          title="Recent sales"
          padded={false}
          action={
            <Link to="/sales" className="text-xs font-medium text-indigo-600 hover:underline">
              View all
            </Link>
          }
          className="lg:col-span-3"
        >
          {sales.length === 0 ? (
            <EmptyState title="No sales yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {sales.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link to={`/sales/${s.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-indigo-600">
                      {customerName(s)}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {s.invoiceNo} - {formatDate(s.date)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-slate-500">{s.paymentMode}</span>
                    <span className="w-20 text-right text-sm font-semibold text-slate-900">{formatINR(s.total)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Recent purchases"
          padded={false}
          action={
            <Link to="/purchases" className="text-xs font-medium text-indigo-600 hover:underline">
              View all
            </Link>
          }
          className="lg:col-span-3"
        >
          {purchases.length === 0 ? (
            <EmptyState title="No purchases yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {purchases.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{sellerName(p.supplier)}</p>
                    <p className="text-xs text-slate-500">
                      {p.invoiceNo} - {formatDate(p.date)} - {p.items.length} items
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="w-20 text-right text-sm font-semibold text-slate-900">{formatINR(p.total)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>


        <Card
          title={period === 'monthly' ? 'Monthly sales and purchases' : 'Yearly sales and purchases'}
          className="lg:col-span-3"
          action={
            <div className="inline-flex shrink-0 rounded-lg bg-slate-100 p-0.5 text-xs font-medium" role="group" aria-label="Period">
              {[
                ['monthly', 'Monthly'],
                ['yearly', 'Yearly'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={period === value}
                  onClick={() => setPeriod(value)}
                  className={`rounded-md px-3 py-1.5 transition-colors ${period === value ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <p className="mb-3 text-xs text-slate-500">{period === 'monthly' ? 'Totals for each of the last 12 months' : 'Totals for each year'}</p>
          <div className="mb-4 grid grid-cols-3 gap-3 text-center sm:text-left">
            <div>
              <p className="text-xs text-slate-500">Sales</p>
              <p className="text-sm font-semibold text-indigo-600 sm:text-base">{formatINR(periodTotals.sales)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Purchases</p>
              <p className="text-sm font-semibold sm:text-base" style={{ color: PURCHASE_COLOR }}>{formatINR(periodTotals.purchases)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Profit</p>
              <p className={`text-sm font-semibold sm:text-base ${periodTotals.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatINR(periodTotals.profit)}</p>
            </div>
          </div>
          <div className="h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodSeries} margin={{ top: 5, right: 4, left: -8, bottom: 0 }} barGap={2} barCategoryGap="18%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tickFormatter={compactINR} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(v) => formatINR(v)} cursor={{ fill: '#f1f5f9' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="sales" name="Sales" fill={SALES_COLOR} radius={[4, 4, 0, 0]} />
                <Bar dataKey="purchases" name="Purchases" fill={PURCHASE_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </>
  );
}
