import { FormEvent, useEffect, useState } from 'react';
import { Plus, Moon, Sun, ShieldCheck } from 'lucide-react';
import { api, apiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Badge, Column, DataTable, ErrorNote, Field, Modal, PageHeader } from '../components/ui';
import { fmtDate } from '../lib/format';

interface UserRow { id: number; name: string; email: string; role: string; is_active: number; created_at: string }

const ROLE_TONE: Record<string, string> = { ADMIN: 'teal', ACCOUNTANT: 'blue', SALES: 'amber', MANAGER: 'green' };

const ROLE_MATRIX = [
  { role: 'ADMIN', can: 'Everything — full access to every module and user management.' },
  { role: 'ACCOUNTANT', can: 'Vouchers, ledgers, reports, payments, invoices, payroll approval & disbursement.' },
  { role: 'SALES', can: 'Bookings, customers, manual invoices, stock issue.' },
  { role: 'MANAGER', can: 'Bookings, suppliers, employees, attendance, payroll generation, all reports.' }
];

export default function Settings() {
  const { user } = useAuth();
  const { dark, toggle } = useTheme();
  const isAdmin = user?.role === 'ADMIN';
  const canSeeUsers = isAdmin || user?.role === 'MANAGER';
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(canSeeUsers);
  const [refresh, setRefresh] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!canSeeUsers) return;
    setLoading(true);
    api.get('/api/auth/users').then((r) => setUsers(r.data.data)).finally(() => setLoading(false));
  }, [refresh, canSeeUsers]);

  const columns: Column<UserRow>[] = [
    { key: 'name', header: 'User', render: (u) => (
        <div><div className="font-medium">{u.name}</div><div className="text-xs text-slate-400">{u.email}</div></div>) },
    { key: 'role', header: 'Role', render: (u) => <Badge tone={ROLE_TONE[u.role] ?? 'slate'}>{u.role}</Badge> },
    { key: 'is_active', header: 'Status', render: (u) => <Badge tone={u.is_active ? 'green' : 'slate'}>{u.is_active ? 'ACTIVE' : 'INACTIVE'}</Badge> },
    { key: 'created_at', header: 'Added', render: (u) => <span className="num">{fmtDate(u.created_at)}</span>, sortValue: (u) => u.created_at }
  ];

  return (
    <div>
      <PageHeader title="Settings" sub="Company users, roles and appearance." />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 font-bold">Appearance</h2>
            <button className="btn btn-ghost w-full justify-between" onClick={toggle}>
              <span className="inline-flex items-center gap-2">{dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} {dark ? 'Dark mode' : 'Light mode'}</span>
              <span className="text-xs text-slate-400">Tap to switch</span>
            </button>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4 text-brand-600" /> Role permissions</h2>
            <ul className="space-y-3 text-sm">
              {ROLE_MATRIX.map((r) => (
                <li key={r.role}>
                  <Badge tone={ROLE_TONE[r.role]}>{r.role}</Badge>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">{r.can}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="xl:col-span-2">
          {canSeeUsers ? (
            <>
              <div className="mb-3 flex justify-end">
                {isAdmin && <button className="btn btn-primary" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New user</button>}
              </div>
              <DataTable columns={columns} rows={users} loading={loading} empty="No users found." />
            </>
          ) : (
            <div className="card p-8 text-center text-sm text-slate-400">
              User management is available to admins and managers.
            </div>
          )}
        </div>
      </div>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); setRefresh(r => r + 1); }} />
    </div>
  );
}

function CreateUserModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'SALES' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.post('/api/auth/register', form);
      setForm({ name: '', email: '', password: '', role: 'SALES' });
      onDone();
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New User">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} /></Field>
        <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Password" hint="At least 6 characters">
            <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
          </Field>
          <Field label="Role">
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="ADMIN">Admin</option><option value="ACCOUNTANT">Accountant</option>
              <option value="SALES">Sales</option><option value="MANAGER">Manager</option>
            </select>
          </Field>
        </div>
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button>
        </div>
      </form>
    </Modal>
  );
}
