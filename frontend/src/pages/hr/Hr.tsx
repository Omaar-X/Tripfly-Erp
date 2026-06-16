import { FormEvent, useEffect, useState } from 'react';
import { Plus, Users, CalendarCheck2, BadgeDollarSign, FileDown, Pencil, PlayCircle, CheckCircle2, Banknote } from 'lucide-react';
import { api, apiErrorMessage, openPdf } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Badge, Column, DataTable, ErrorNote, Field, Modal, Money, PageHeader, Spinner, statusTone } from '../../components/ui';
import { bdt, fmtDate, today } from '../../lib/format';

type Tab = 'employees' | 'attendance' | 'payroll';

interface Employee {
  id: number; emp_code: string; name: string; designation: string | null; department: string | null;
  phone: string | null; email: string | null; joining_date: string | null;
  basic_salary: string; house_rent: string; medical_allow: string; conveyance: string;
  commission_rate: string; gross_salary: string; is_active: number;
}
interface Run {
  id: number; period_year: number; period_month: number; status: string;
  total_net: string; employees: number; voucher_no: string | null;
}
interface RunDetail extends Run {
  payslips: {
    id: number; emp_code: string; name: string; designation: string | null;
    working_days: number; present_days: string; basic: string; allowances: string;
    commission: string; absence_deduction: string; net_pay: string;
  }[];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Hr() {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const isManager = ['ADMIN', 'MANAGER'].includes(role);
  const canPayroll = ['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(role);
  const canPay = ['ADMIN', 'ACCOUNTANT'].includes(role);
  const [tab, setTab] = useState<Tab>('employees');

  const tabs: { id: Tab; label: string; icon: JSX.Element }[] = [
    { id: 'employees', label: 'Employees', icon: <Users className="h-4 w-4" /> },
    { id: 'attendance', label: 'Attendance', icon: <CalendarCheck2 className="h-4 w-4" /> },
    { id: 'payroll', label: 'Payroll', icon: <BadgeDollarSign className="h-4 w-4" /> }
  ];

  return (
    <div>
      <PageHeader title="HR & Payroll" sub="Attendance-driven salaries, agent commissions, payslips — posted straight into the books." />
      <div className="mb-4 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900 w-fit">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition
              ${tab === t.id ? 'bg-brand-950 text-white shadow' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'employees' && <EmployeesTab isManager={isManager} />}
      {tab === 'attendance' && <AttendanceTab isManager={isManager} />}
      {tab === 'payroll' && <PayrollTab canPayroll={canPayroll} canPay={canPay} />}
    </div>
  );
}

// ================================ Employees ==================================

function EmployeesTab({ isManager }: { isManager: boolean }) {
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/api/hr/employees').then((r) => setRows(r.data.data)).finally(() => setLoading(false));
  }, [refresh]);

  const columns: Column<Employee>[] = [
    { key: 'emp_code', header: 'Code', render: (e) => <span className="num text-xs font-semibold">{e.emp_code}</span> },
    { key: 'name', header: 'Employee', render: (e) => (
        <div><div className="font-medium">{e.name}</div><div className="text-xs text-slate-400">{e.designation ?? '—'} · {e.department ?? '—'}</div></div>) },
    { key: 'joining_date', header: 'Joined', render: (e) => <span className="num">{e.joining_date ? fmtDate(e.joining_date) : '—'}</span> },
    { key: 'gross_salary', header: 'Gross salary', align: 'right', render: (e) => <Money value={e.gross_salary} />, sortValue: (e) => Number(e.gross_salary) },
    { key: 'commission_rate', header: 'Commission', align: 'right', render: (e) => <span className="num">{Number(e.commission_rate)}%</span> },
    { key: 'is_active', header: 'Status', render: (e) => <Badge tone={e.is_active ? 'green' : 'slate'}>{e.is_active ? 'ACTIVE' : 'INACTIVE'}</Badge> },
    { key: 'actions', header: '', align: 'right', render: (e) => isManager ? (
        <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => setEditing(e)}><Pencil className="h-3.5 w-3.5" /> Edit</button>) : null }
  ];

  return (
    <>
      <div className="mb-3 flex justify-end">
        {isManager && <button className="btn btn-primary" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New employee</button>}
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} empty="No employees yet." />
      <EmployeeModal open={createOpen || !!editing} employee={editing}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        onDone={() => { setCreateOpen(false); setEditing(null); setRefresh(r => r + 1); }} />
    </>
  );
}

function EmployeeModal({ open, employee, onClose, onDone }:
  { open: boolean; employee: Employee | null; onClose: () => void; onDone: () => void }) {
  const blank = { empCode: '', name: '', designation: '', department: '', phone: '', email: '', joiningDate: '', basicSalary: '', houseRent: '0', medicalAllow: '0', conveyance: '0', commissionRate: '0', isActive: true };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (employee) {
      setForm({
        empCode: employee.emp_code, name: employee.name,
        designation: employee.designation ?? '', department: employee.department ?? '',
        phone: employee.phone ?? '', email: employee.email ?? '',
        joiningDate: employee.joining_date ? employee.joining_date.slice(0, 10) : '',
        basicSalary: String(Number(employee.basic_salary)), houseRent: String(Number(employee.house_rent)),
        medicalAllow: String(Number(employee.medical_allow)), conveyance: String(Number(employee.conveyance)),
        commissionRate: String(Number(employee.commission_rate)), isActive: !!employee.is_active
      });
    } else setForm(blank);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee, open]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const payload = {
        empCode: form.empCode, name: form.name,
        designation: form.designation || undefined, department: form.department || undefined,
        phone: form.phone || undefined, email: form.email || undefined,
        joiningDate: form.joiningDate || undefined,
        basicSalary: Number(form.basicSalary) || 0, houseRent: Number(form.houseRent) || 0,
        medicalAllow: Number(form.medicalAllow) || 0, conveyance: Number(form.conveyance) || 0,
        commissionRate: Number(form.commissionRate) || 0
      };
      if (employee) await api.patch(`/api/hr/employees/${employee.id}`, { ...payload, isActive: form.isActive });
      else await api.post('/api/hr/employees', payload);
      onDone();
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={employee ? `Edit ${employee.name}` : 'New Employee'} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Employee code"><input className="input num" value={form.empCode} onChange={set('empCode')} required placeholder="EMP-004" /></Field>
          <Field label="Full name"><input className="input" value={form.name} onChange={set('name')} required minLength={2} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Designation"><input className="input" value={form.designation} onChange={set('designation')} placeholder="e.g. Ticketing Officer" /></Field>
          <Field label="Department"><input className="input" value={form.department} onChange={set('department')} placeholder="e.g. Sales" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Phone"><input className="input num" value={form.phone} onChange={set('phone')} /></Field>
          <Field label="Email"><input className="input" type="email" value={form.email} onChange={set('email')} /></Field>
          <Field label="Joining date"><input type="date" className="input num" value={form.joiningDate} onChange={set('joiningDate')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Field label="Basic (৳)"><input className="input num" type="number" min="0" step="0.01" value={form.basicSalary} onChange={set('basicSalary')} required /></Field>
          <Field label="House rent"><input className="input num" type="number" min="0" step="0.01" value={form.houseRent} onChange={set('houseRent')} /></Field>
          <Field label="Medical"><input className="input num" type="number" min="0" step="0.01" value={form.medicalAllow} onChange={set('medicalAllow')} /></Field>
          <Field label="Conveyance"><input className="input num" type="number" min="0" step="0.01" value={form.conveyance} onChange={set('conveyance')} /></Field>
          <Field label="Commission %" hint="On booking margin"><input className="input num" type="number" min="0" max="100" step="0.5" value={form.commissionRate} onChange={set('commissionRate')} /></Field>
        </div>
        {employee && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            Active employee (included in payroll)
          </label>
        )}
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : employee ? 'Save changes' : 'Create employee'}</button>
        </div>
      </form>
    </Modal>
  );
}

// =============================== Attendance ==================================

const ATT_STATUSES = ['PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY'] as const;
type AttStatus = typeof ATT_STATUSES[number];

function AttendanceTab({ isManager }: { isManager: boolean }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sheet, setSheet] = useState<{ workingDays: number; rows: { employee_id: number; att_date: string; status: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  // mark-today widget
  const [markDate, setMarkDate] = useState(today());
  const [marks, setMarks] = useState<Record<number, AttStatus>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/api/hr/employees'),
      api.get('/api/hr/attendance', { params: { year, month } })
    ]).then(([e, a]) => { setEmployees(e.data.data); setSheet(a.data.data); })
      .finally(() => setLoading(false));
  }, [year, month, refresh]);

  const active = employees.filter((e) => e.is_active);
  const counts = (empId: number) => {
    const rows = sheet?.rows.filter((r) => r.employee_id === empId) ?? [];
    const c = { PRESENT: 0, ABSENT: 0, LEAVE: 0, HALF_DAY: 0 } as Record<string, number>;
    rows.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  };

  const save = async () => {
    setBusy(true); setError(null); setSaved(false);
    try {
      const payload = {
        date: markDate,
        marks: active.map((e) => ({ employeeId: e.id, status: marks[e.id] ?? 'PRESENT' }))
      };
      await api.post('/api/hr/attendance', payload);
      setSaved(true);
      setRefresh((r) => r + 1);
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {isManager && (
        <div className="card p-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-bold">Mark attendance</h2>
            <Field label="Date"><input type="date" className="input num" value={markDate} onChange={(e) => setMarkDate(e.target.value)} max={today()} /></Field>
          </div>
          <div className="space-y-2">
            {active.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
                <div className="text-sm"><span className="num text-xs text-slate-400">{e.emp_code}</span> <span className="font-medium">{e.name}</span></div>
                <div className="flex gap-1">
                  {ATT_STATUSES.map((s) => (
                    <button key={s} type="button" onClick={() => setMarks({ ...marks, [e.id]: s })}
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition
                        ${(marks[e.id] ?? 'PRESENT') === s
                          ? s === 'PRESENT' ? 'bg-emerald-600 text-white' : s === 'ABSENT' ? 'bg-rose-600 text-white' : s === 'LEAVE' ? 'bg-sky-600 text-white' : 'bg-amber-500 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <ErrorNote message={error} />
            {saved && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">Attendance saved ✓</div>}
            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={save} disabled={busy || active.length === 0}>{busy ? 'Saving…' : 'Save attendance'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-bold">Monthly sheet <span className="num text-sm font-normal text-slate-400">{sheet ? `· ${sheet.workingDays} working days (Fri off)` : ''}</span></h2>
          <div className="flex gap-2">
            <select className="input !w-auto" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select className="input !w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[year - 1, year, year + 1].filter((v, i, a) => a.indexOf(v) === i).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        {loading ? <div className="flex h-32 items-center justify-center"><Spinner /></div> : (
          <table className="w-full text-sm">
            <thead><tr>
              <th className="th text-left">Employee</th>
              <th className="th text-right">Present</th><th className="th text-right">Half day</th>
              <th className="th text-right">Leave</th><th className="th text-right">Absent</th>
            </tr></thead>
            <tbody>
              {active.map((e) => {
                const c = counts(e.id);
                return (
                  <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="td"><span className="num text-xs text-slate-400">{e.emp_code}</span> <span className="font-medium">{e.name}</span></td>
                    <td className="td num text-right text-emerald-600">{c.PRESENT}</td>
                    <td className="td num text-right text-amber-600">{c.HALF_DAY}</td>
                    <td className="td num text-right text-sky-600">{c.LEAVE}</td>
                    <td className="td num text-right text-rose-600">{c.ABSENT}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-slate-400">No marks at all in a month counts as full presence. Leave is paid; half days count as 0.5.</p>
      </div>
    </div>
  );
}

// ================================ Payroll ====================================

function PayrollTab({ canPayroll, canPay }: { canPayroll: boolean; canPay: boolean }) {
  const now = new Date();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.get('/api/hr/payroll').then((r) => setRuns(r.data.data)).finally(() => setLoading(false));
  }, [refresh]);

  const openDetail = (id: number) => api.get(`/api/hr/payroll/${id}`).then((r) => setDetail(r.data.data));

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label); setError(null);
    try {
      await fn();
      setRefresh((r) => r + 1);
      if (detail) await openDetail(detail.id);
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { setBusy(null); }
  };

  const generate = () => act('generate', () => api.post('/api/hr/payroll/generate', { year, month }));

  const columns: Column<Run>[] = [
    { key: 'period', header: 'Period', render: (r) => <span className="num font-medium">{MONTHS[r.period_month - 1]} {r.period_year}</span>,
      sortValue: (r) => r.period_year * 100 + r.period_month },
    { key: 'employees', header: 'Employees', align: 'right', render: (r) => <span className="num">{r.employees}</span> },
    { key: 'total_net', header: 'Total net pay', align: 'right', render: (r) => <Money value={r.total_net} />, sortValue: (r) => Number(r.total_net) },
    { key: 'status', header: 'Status', render: (r) => (
        <div className="flex flex-col items-start gap-0.5">
          <Badge tone={statusTone(r.status)}>{r.status}</Badge>
          {r.voucher_no && <span className="num text-[10px] text-slate-400">{r.voucher_no}</span>}
        </div>) },
    { key: 'actions', header: '', align: 'right', render: (r) => (
        <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => openDetail(r.id)}>Open</button>) }
  ];

  return (
    <div className="space-y-4">
      {canPayroll && (
        <div className="card flex flex-wrap items-end gap-3 p-5">
          <Field label="Month">
            <select className="input !w-auto" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Field>
          <Field label="Year">
            <input className="input num !w-28" type="number" min="2020" max="2100" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </Field>
          <button className="btn btn-primary" onClick={generate} disabled={busy === 'generate'}>
            <PlayCircle className="h-4 w-4" /> {busy === 'generate' ? 'Computing…' : 'Generate run'}
          </button>
          <p className="basis-full text-xs text-slate-400">
            Net pay = gross − absence deduction + commission on confirmed-booking margins. Regenerating is allowed while the run is still DRAFT.
          </p>
        </div>
      )}
      <ErrorNote message={error} />
      <DataTable columns={columns} rows={runs} loading={loading} empty="No payroll runs yet — generate one above." />

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Payroll — ${MONTHS[detail.period_month - 1]} ${detail.period_year}` : ''} wide>
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge tone={statusTone(detail.status)}>{detail.status}</Badge>
                {detail.voucher_no && <span className="num text-xs text-slate-400">Voucher {detail.voucher_no}</span>}
              </div>
              <div className="flex gap-2">
                {canPayroll && detail.status === 'DRAFT' && (
                  <button className="btn btn-primary" disabled={busy === 'approve'}
                    onClick={() => act('approve', () => api.post(`/api/hr/payroll/${detail.id}/approve`))}>
                    <CheckCircle2 className="h-4 w-4" /> {busy === 'approve' ? 'Posting…' : 'Approve & accrue'}
                  </button>)}
                {canPay && detail.status === 'APPROVED' && (
                  <button className="btn btn-primary" disabled={busy === 'pay'}
                    onClick={() => act('pay', () => api.post(`/api/hr/payroll/${detail.id}/pay`, { method: 'BANK' }))}>
                    <Banknote className="h-4 w-4" /> {busy === 'pay' ? 'Paying…' : 'Pay via bank'}
                  </button>)}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr>
                  <th className="th text-left">Employee</th><th className="th text-right">Days</th>
                  <th className="th text-right">Basic</th><th className="th text-right">Allowances</th>
                  <th className="th text-right">Commission</th><th className="th text-right">Absence ded.</th>
                  <th className="th text-right">Net pay</th><th className="th"></th>
                </tr></thead>
                <tbody>
                  {detail.payslips.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="td"><span className="num text-xs text-slate-400">{p.emp_code}</span> <span className="font-medium">{p.name}</span></td>
                      <td className="td num text-right">{Number(p.present_days)}/{p.working_days}</td>
                      <td className="td num text-right">{bdt(Number(p.basic))}</td>
                      <td className="td num text-right">{bdt(Number(p.allowances))}</td>
                      <td className="td num text-right text-emerald-600">{Number(p.commission) ? `+ ${bdt(Number(p.commission))}` : '—'}</td>
                      <td className="td num text-right text-rose-600">{Number(p.absence_deduction) ? `− ${bdt(Number(p.absence_deduction))}` : '—'}</td>
                      <td className="td num text-right font-semibold">{bdt(Number(p.net_pay))}</td>
                      <td className="td text-right">
                        <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => openPdf(`/api/hr/payslips/${p.id}/pdf`)}>
                          <FileDown className="h-3.5 w-3.5" /> Slip
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 font-bold dark:border-slate-700">
                    <td className="td" colSpan={6}>Total</td>
                    <td className="td num text-right">{bdt(Number(detail.total_net))}</td>
                    <td className="td"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <ErrorNote message={error} />
          </div>
        )}
      </Modal>
    </div>
  );
}
