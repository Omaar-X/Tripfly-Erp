import { FormEvent, useEffect, useState } from 'react';
import { Plus, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { api, apiErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Badge, Column, DataTable, ErrorNote, Field, Modal, Money, PageHeader, statusTone } from '../../components/ui';
import { bdt, fmtDate, today } from '../../lib/format';

interface PaymentRow {
  id: number; payment_no: string; direction: 'IN' | 'OUT'; method: string;
  amount: string; payment_date: string; notes: string | null;
  customer_name: string | null; supplier_name: string | null; invoice_no?: string | null;
}
interface Lookup { id: number; name: string }
interface OpenInvoice { id: number; invoice_no: string; customer_id: number; customer_name: string; due: string; status: string }

const METHODS = ['CASH', 'BANK', 'BKASH', 'NAGAD', 'CARD'] as const;

export default function Payments() {
  const { user } = useAuth();
  const canRecord = ['ADMIN', 'ACCOUNTANT', 'MANAGER'].includes(user?.role ?? '');
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [direction, setDirection] = useState('');
  const [recordOpen, setRecordOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/api/payments', { params: direction ? { direction } : {} })
      .then((r) => setRows(r.data.data))
      .finally(() => setLoading(false));
  }, [direction, refresh]);

  const columns: Column<PaymentRow>[] = [
    { key: 'payment_no', header: 'Payment', render: (p) => <span className="num font-medium">{p.payment_no}</span> },
    { key: 'direction', header: 'Direction', render: (p) => (
        <Badge tone={statusTone(p.direction)}>
          <span className="inline-flex items-center gap-1">
            {p.direction === 'IN' ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}{p.direction}
          </span>
        </Badge>) },
    { key: 'party', header: 'Party', render: (p) => p.customer_name ?? p.supplier_name ?? '—' },
    { key: 'method', header: 'Method', render: (p) => <Badge tone="blue">{p.method}</Badge> },
    { key: 'payment_date', header: 'Date', render: (p) => <span className="num">{fmtDate(p.payment_date)}</span>, sortValue: (p) => p.payment_date },
    { key: 'amount', header: 'Amount', align: 'right',
      render: (p) => <Money value={p.amount} className={p.direction === 'IN' ? 'text-emerald-600' : 'text-rose-600'} />,
      sortValue: (p) => Number(p.amount) },
    { key: 'notes', header: 'Notes', render: (p) => <span className="block max-w-[200px] truncate text-slate-500">{p.notes ?? '—'}</span> }
  ];

  return (
    <div>
      <PageHeader title="Payments" sub="Money in from customers, money out to suppliers — each posts its own voucher."
        actions={canRecord ? <button className="btn btn-primary" onClick={() => setRecordOpen(true)}><Plus className="h-4 w-4" /> Record payment</button> : undefined} />

      <div className="mb-3 flex justify-end">
        <select className="input !w-auto" value={direction} onChange={(e) => setDirection(e.target.value)}>
          <option value="">All directions</option>
          <option value="IN">IN — received</option>
          <option value="OUT">OUT — paid</option>
        </select>
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} empty="No payments recorded yet." />

      <RecordModal open={recordOpen} onClose={() => setRecordOpen(false)} onDone={() => { setRecordOpen(false); setRefresh(r => r + 1); }} />
    </div>
  );
}

function RecordModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [suppliers, setSuppliers] = useState<Lookup[]>([]);
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);
  const [form, setForm] = useState({
    direction: 'IN' as 'IN' | 'OUT', customerId: '', supplierId: '',
    invoiceId: '', method: 'CASH', amount: '', paymentDate: today(), notes: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get('/api/crm/customers').then((r) => setCustomers(r.data.data));
    api.get('/api/crm/suppliers').then((r) => setSuppliers(r.data.data));
    api.get('/api/invoices').then((r) =>
      setInvoices((r.data.data as OpenInvoice[]).filter((i) => i.status === 'UNPAID' || i.status === 'PARTIAL')));
  }, [open]);

  const openForCustomer = invoices.filter((i) => String(i.customer_id) === form.customerId);
  const selectedInvoice = invoices.find((i) => String(i.id) === form.invoiceId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.post('/api/payments', {
        direction: form.direction,
        customerId: form.direction === 'IN' ? Number(form.customerId) : undefined,
        supplierId: form.direction === 'OUT' ? Number(form.supplierId) : undefined,
        invoiceId: form.direction === 'IN' && form.invoiceId ? Number(form.invoiceId) : undefined,
        method: form.method,
        amount: Number(form.amount),
        paymentDate: form.paymentDate,
        notes: form.notes || undefined
      });
      setForm({ direction: 'IN', customerId: '', supplierId: '', invoiceId: '', method: 'CASH', amount: '', paymentDate: today(), notes: '' });
      onDone();
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Record Payment">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(['IN', 'OUT'] as const).map((d) => (
            <button key={d} type="button"
              onClick={() => setForm({ ...form, direction: d, customerId: '', supplierId: '', invoiceId: '' })}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition
                ${form.direction === d
                  ? d === 'IN' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                               : 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}>
              {d === 'IN' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
              {d === 'IN' ? 'Receive from customer' : 'Pay supplier'}
            </button>
          ))}
        </div>

        {form.direction === 'IN' ? (
          <>
            <Field label="Customer">
              <select className="input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value, invoiceId: '' })} required>
                <option value="">Select customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Settle against invoice" hint="Optional — updates the invoice's paid status">
              <select className="input" value={form.invoiceId} onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}>
                <option value="">On account (no specific invoice)</option>
                {openForCustomer.map((i) => <option key={i.id} value={i.id}>{i.invoice_no} — due {bdt(Number(i.due))}</option>)}
              </select>
            </Field>
            {selectedInvoice && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                Balance due on {selectedInvoice.invoice_no}: <span className="num font-semibold">{bdt(Number(selectedInvoice.due))}</span> — overpayment is rejected.
              </p>
            )}
          </>
        ) : (
          <Field label="Supplier">
            <select className="input" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} required>
              <option value="">Select supplier…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Field label="Method">
            <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Amount (৳)"><input className="input num" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></Field>
          <Field label="Date"><input type="date" className="input num" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} required /></Field>
        </div>
        <Field label="Notes"><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" /></Field>

        <ErrorNote message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Posting…' : 'Record payment'}</button>
        </div>
      </form>
    </Modal>
  );
}
