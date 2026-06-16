import { useEffect, useState } from 'react';
import { Scale, TrendingUp, Landmark, Wallet, Banknote, BookText, Users } from 'lucide-react';
import { api } from '../../api/client';
import { Badge, Field, Spinner, PageHeader, statusTone } from '../../components/ui';
import { bdt, fmtDate, today } from '../../lib/format';

type Tab = 'tb' | 'pl' | 'bs' | 'cash' | 'bank' | 'day' | 'outstanding';

const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  { id: 'tb', label: 'Trial Balance', icon: <Scale className="h-4 w-4" /> },
  { id: 'pl', label: 'Profit & Loss', icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'bs', label: 'Balance Sheet', icon: <Landmark className="h-4 w-4" /> },
  { id: 'cash', label: 'Cash Book', icon: <Wallet className="h-4 w-4" /> },
  { id: 'bank', label: 'Bank Book', icon: <Banknote className="h-4 w-4" /> },
  { id: 'day', label: 'Day Book', icon: <BookText className="h-4 w-4" /> },
  { id: 'outstanding', label: 'Customer Outstanding', icon: <Users className="h-4 w-4" /> }
];

export default function Reports() {
  const year = new Date().getFullYear();
  const [tab, setTab] = useState<Tab>('tb');
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(today());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url =
      tab === 'tb' ? '/api/reports/trial-balance' :
      tab === 'pl' ? '/api/reports/profit-loss' :
      tab === 'bs' ? '/api/reports/balance-sheet' :
      tab === 'cash' ? '/api/reports/cash-book' :
      tab === 'bank' ? '/api/reports/bank-book' :
      tab === 'day' ? '/api/reports/day-book' : '/api/reports/customer-outstanding';
    const params = tab === 'bs' ? { asOn: to } : tab === 'outstanding' ? {} : { from, to };
    setLoading(true);
    api.get(url, { params }).then((r) => setData(r.data.data)).finally(() => setLoading(false));
  }, [tab, from, to]);

  return (
    <div>
      <PageHeader title="Reports" sub="Statutory and management reports, computed live from the voucher ledger." />

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900 w-fit">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition
              ${tab === t.id ? 'bg-brand-950 text-white shadow' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab !== 'outstanding' && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          {tab !== 'bs' && <Field label="From"><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>}
          <Field label={tab === 'bs' ? 'As on' : 'To'}><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
      )}

      {loading ? <div className="flex h-48 items-center justify-center"><Spinner /></div> : data && (
        <div className="card overflow-x-auto p-5">
          {tab === 'tb' && <TrialBalance data={data} />}
          {tab === 'pl' && <ProfitLoss data={data} />}
          {tab === 'bs' && <BalanceSheet data={data} />}
          {(tab === 'cash' || tab === 'bank') && <BookTable rows={data} />}
          {tab === 'day' && <DayBook rows={data} />}
          {tab === 'outstanding' && <Outstanding rows={data} />}
        </div>
      )}
    </div>
  );
}

const BalancedFlag = ({ ok }: { ok: boolean }) => (
  <Badge tone={ok ? 'green' : 'rose'}>{ok ? 'BALANCED ✓' : 'OUT OF BALANCE'}</Badge>
);

function TrialBalance({ data }: { data: any }) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">Trial Balance</h2>
        <BalancedFlag ok={data.balanced} />
      </div>
      <table className="w-full text-sm">
        <thead><tr>
          <th className="th text-left">Ledger</th><th className="th text-left">Group</th>
          <th className="th text-right">Debit</th><th className="th text-right">Credit</th>
        </tr></thead>
        <tbody>
          {data.lines.map((l: any) => (
            <tr key={l.ledger_id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="td font-medium">{l.ledger}</td>
              <td className="td text-slate-500">{l.group}</td>
              <td className="td num text-right">{l.debit ? bdt(l.debit) : ''}</td>
              <td className="td num text-right">{l.credit ? bdt(l.credit) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 font-bold dark:border-slate-700">
            <td className="td" colSpan={2}>Total</td>
            <td className="td num text-right">{bdt(data.totalDebit)}</td>
            <td className="td num text-right">{bdt(data.totalCredit)}</td>
          </tr>
        </tfoot>
      </table>
    </>
  );
}

function ProfitLoss({ data }: { data: any }) {
  const profit = data.netProfit >= 0;
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">Profit &amp; Loss Statement</h2>
        <Badge tone={profit ? 'green' : 'rose'}>{profit ? 'NET PROFIT' : 'NET LOSS'} {bdt(Math.abs(data.netProfit))}</Badge>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-600">Income</h3>
          <table className="w-full text-sm">
            <tbody>
              {data.income.map((r: any, i: number) => (
                <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="td">{r.ledger}</td><td className="td num text-right">{bdt(r.amount)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-bold dark:border-slate-700">
                <td className="td">Total income</td><td className="td num text-right">{bdt(data.totalIncome)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-600">Expenses</h3>
          <table className="w-full text-sm">
            <tbody>
              {data.expenses.map((r: any, i: number) => (
                <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="td">{r.ledger}</td><td className="td num text-right">{bdt(r.amount)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-bold dark:border-slate-700">
                <td className="td">Total expenses</td><td className="td num text-right">{bdt(data.totalExpense)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function BalanceSheet({ data }: { data: any }) {
  const Section = ({ title, rows, total }: { title: string; rows: any[]; total: number }) => (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r: any, i: number) => (
            <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
              <td className="td">{r.ledger}<span className="ml-2 text-xs text-slate-400">{r.group}</span></td>
              <td className="td num text-right">{bdt(r.amount)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-300 font-bold dark:border-slate-700">
            <td className="td">Total {title.toLowerCase()}</td><td className="td num text-right">{bdt(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">Balance Sheet <span className="num text-sm font-normal text-slate-400">as on {fmtDate(data.asOn)}</span></h2>
        <BalancedFlag ok={data.balanced} />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Assets" rows={data.assets} total={data.totalAssets} />
        <div className="space-y-6">
          <Section title="Liabilities" rows={data.liabilities} total={data.totalLiabilities} />
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Equity</h3>
            <table className="w-full text-sm">
              <tbody>
                {data.equity.map((r: any, i: number) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="td">{r.ledger}</td><td className="td num text-right">{bdt(r.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td className="td">Retained earnings (P&amp;L)</td><td className="td num text-right">{bdt(data.retainedEarnings)}</td>
                </tr>
                <tr className="border-t-2 border-slate-300 font-bold dark:border-slate-700">
                  <td className="td">Liabilities + Equity</td><td className="td num text-right">{bdt(data.totalLiabilitiesAndEquity)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function BookTable({ rows }: { rows: any[] }) {
  return (
    <table className="w-full text-sm">
      <thead><tr>
        <th className="th text-left">Date</th><th className="th text-left">Voucher</th>
        <th className="th text-left">Ledger</th><th className="th text-left">Narration</th>
        <th className="th text-right">Receipt (Dr)</th><th className="th text-right">Payment (Cr)</th>
      </tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={6} className="td py-8 text-center text-slate-400">No movement in this period.</td></tr>}
        {rows.map((r: any, i: number) => (
          <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
            <td className="td num">{fmtDate(r.voucher_date)}</td>
            <td className="td"><span className="num text-xs">{r.voucher_no}</span> <Badge tone="teal">{r.voucher_type}</Badge></td>
            <td className="td">{r.ledger}</td>
            <td className="td max-w-[220px] truncate text-slate-500">{r.narration ?? '—'}</td>
            <td className="td num text-right">{r.entry_type === 'DR' ? bdt(Number(r.amount)) : ''}</td>
            <td className="td num text-right">{r.entry_type === 'CR' ? bdt(Number(r.amount)) : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DayBook({ rows }: { rows: any[] }) {
  return (
    <table className="w-full text-sm">
      <thead><tr>
        <th className="th text-left">Date</th><th className="th text-left">Voucher</th><th className="th text-left">Type</th>
        <th className="th text-left">Narration</th><th className="th text-right">Amount</th><th className="th text-left">By</th>
      </tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={6} className="td py-8 text-center text-slate-400">No vouchers in this period.</td></tr>}
        {rows.map((r: any) => (
          <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
            <td className="td num">{fmtDate(r.voucher_date)}</td>
            <td className="td num">{r.voucher_no}</td>
            <td className="td"><Badge tone="teal">{r.voucher_type}</Badge></td>
            <td className="td max-w-[260px] truncate text-slate-500">{r.narration ?? '—'}</td>
            <td className="td num text-right">{bdt(Number(r.total_amount))}</td>
            <td className="td">{r.created_by}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Outstanding({ rows }: { rows: any[] }) {
  return (
    <table className="w-full text-sm">
      <thead><tr>
        <th className="th text-left">Customer</th><th className="th text-left">Phone</th>
        <th className="th text-right">Credit limit</th><th className="th text-right">Outstanding</th><th className="th text-left">Status</th>
      </tr></thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={5} className="td py-8 text-center text-slate-400">No customers with balances.</td></tr>}
        {rows.map((r: any) => {
          const over = Number(r.credit_limit) > 0 && Number(r.outstanding) > Number(r.credit_limit);
          return (
            <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="td font-medium">{r.name}</td>
              <td className="td num">{r.phone ?? '—'}</td>
              <td className="td num text-right">{bdt(Number(r.credit_limit))}</td>
              <td className="td num text-right font-semibold">{bdt(Number(r.outstanding))}</td>
              <td className="td"><Badge tone={over ? 'rose' : statusTone(Number(r.outstanding) > 0 ? 'PENDING' : 'PAID')}>{over ? 'OVER LIMIT' : Number(r.outstanding) > 0 ? 'DUE' : 'CLEAR'}</Badge></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
