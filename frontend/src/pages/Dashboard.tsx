import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, ReceiptText,
  Plane, Activity, DollarSign, LayoutDashboard,
} from 'lucide-react';
import { api } from '../api/client';
import { StatCard, Spinner, PageHeader, Badge, statusTone } from '../components/ui';
import { bdt, compactBdt, fmtDate } from '../lib/format';

interface Summary {
  revenueYtd: number; expensesYtd: number; netProfitYtd: number;
  receivables: number; cashAndBank: number;
  bookingsThisMonth: { status: string; count: number }[];
}
interface MonthPoint  { month: string; revenue: number; expense: number; profit: number }
interface TypeSlice   { bookingType: string; total: number }
interface ActivityRow { id: number; user_name: string; action: string; entity: string; created_at: string }

const SLICE_COLORS = ['#0f766e', '#14b8a6', '#f59e0b', '#64748b', '#6366f1'];

// Custom tooltip for recharts
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-card-md text-xs">
      <p className="mb-1.5 font-semibold text-slate-600 dark:text-slate-300">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500 dark:text-slate-400">{p.name}:</span>
          <span className="num font-semibold">{bdt(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [monthly, setMonthly]   = useState<MonthPoint[]>([]);
  const [byType, setByType]     = useState<TypeSlice[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/dashboard/summary'),
      api.get('/api/dashboard/monthly'),
      api.get('/api/dashboard/revenue-by-type'),
      api.get('/api/dashboard/activity'),
    ])
      .then(([s, m, t, a]) => {
        setSummary(s.data.data);
        setMonthly(m.data.data);
        setByType(t.data.data);
        setActivity(a.data.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-400">Loading dashboard…</p>
        </div>
      </div>
    );
  }
  if (!summary) return null;

  const bookings    = summary.bookingsThisMonth ?? [];
  const totalBook   = bookings.reduce((s, b) => s + Number(b.count), 0);
  const profitPct   = summary.revenueYtd > 0
    ? Math.round((summary.netProfitYtd / summary.revenueYtd) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        icon={LayoutDashboard}
        sub="Live financial snapshot — revenue, expenses, bookings, and activity."
      />

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          accent
          color="brand"
          icon={TrendingUp}
          label="Net Profit (YTD)"
          value={bdt(summary.netProfitYtd)}
          sub={`${profitPct}% profit margin`}
        />
        <StatCard
          color="emerald"
          icon={DollarSign}
          label="Revenue (YTD)"
          value={bdt(summary.revenueYtd)}
          sub="All income ledgers"
        />
        <StatCard
          color="rose"
          icon={TrendingDown}
          label="Expenses (YTD)"
          value={bdt(summary.expensesYtd)}
          sub="All expense ledgers"
        />
        <StatCard
          color="blue"
          icon={Wallet}
          label="Cash & Bank"
          value={bdt(summary.cashAndBank)}
          sub={`Receivables ${compactBdt(summary.receivables)}`}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">

        {/* Area chart */}
        <div className="card p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold">Revenue vs Expenses</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Last 12 months</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-600" />Revenue</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Expenses</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#0f766e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => compactBdt(Number(v))} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={68} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#0f766e" fill="url(#gRev)" strokeWidth={2.5} dot={false} />
                <Area type="monotone" dataKey="expense" name="Expenses" stroke="#f59e0b" fill="url(#gExp)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie chart */}
        <div className="card p-5">
          <div>
            <h2 className="font-bold">Revenue by Service</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Confirmed bookings</p>
          </div>
          {byType.length === 0 ? (
            <div className="flex h-56 flex-col items-center justify-center gap-2">
              <Plane className="h-8 w-8 text-slate-300 dark:text-slate-700" />
              <p className="text-sm text-slate-400 dark:text-slate-500">No confirmed bookings yet</p>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byType}
                    dataKey="total"
                    nameKey="bookingType"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={4}
                    strokeWidth={0}
                  >
                    {byType.map((_, i) => <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v) => bdt(Number(v))}
                    contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #e2e8f0' }}
                  />
                  <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">

        {/* Bookings this month */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold">Bookings This Month</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{totalBook} total</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950">
              <Plane className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            </div>
          </div>

          {totalBook === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              No bookings this month yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {bookings.map((b) => (
                <li key={b.status} className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 px-4 py-2.5">
                  <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                  <span className="num text-sm font-bold">{b.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent activity */}
        <div className="card p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-bold">Recent Activity</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Audit trail</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <Activity className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </div>
          </div>

          {activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              No activity recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3 text-sm">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
                    <ReceiptText className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold">{a.user_name ?? 'System'}</span>{' '}
                    <span className="text-slate-500 dark:text-slate-400">
                      {a.action.toLowerCase().replaceAll('_', ' ')}
                    </span>{' '}
                    <span className="font-medium text-brand-700 dark:text-brand-300">{a.entity}</span>
                  </div>
                  <span className="num flex-shrink-0 text-xs text-slate-400 dark:text-slate-500">
                    {fmtDate(a.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
