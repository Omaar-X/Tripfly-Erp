import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plane, Lock, Mail, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiErrorMessage } from '../api/client';
import { ErrorNote } from '../components/ui';

const SEEDED = [
  { role: 'Admin',      email: 'admin@tripflybd.com',      pass: 'admin123', color: 'from-brand-500 to-brand-700' },
  { role: 'Accountant', email: 'accountant@tripflybd.com', pass: 'user123',  color: 'from-sky-500 to-sky-700' },
  { role: 'Sales',      email: 'sales@tripflybd.com',      pass: 'user123',  color: 'from-violet-500 to-violet-700' },
  { role: 'Manager',    email: 'manager@tripflybd.com',    pass: 'user123',  color: 'from-amber-500 to-amber-700' },
];

const FEATURES = [
  'Double-Entry Accounting',
  'Travel Bookings & Invoicing',
  'Inventory (FIFO/Avg)',
  'HR & Payroll',
  'CRM & Suppliers',
  'Audit Trail',
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname?: string } } };

  const [email, setEmail]       = useState('admin@tripflybd.com');
  const [password, setPassword] = useState('admin123');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate(location.state?.from?.pathname ?? '/', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-[#060c16]">

      {/* ── Left brand panel ── */}
      <div className="relative hidden w-[52%] flex-col overflow-hidden lg:flex"
           style={{ background: 'linear-gradient(155deg, #042f2e 0%, #0a1f1c 40%, #061212 100%)' }}>

        {/* Subtle grid pattern */}
        <div className="absolute inset-0"
             style={{ backgroundImage: 'linear-gradient(rgb(255 255 255/0.03) 1px, transparent 1px), linear-gradient(to right, rgb(255 255 255/0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Radial glow accents */}
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -right-16 bottom-1/3 h-64 w-64 rounded-full bg-brand-600/10 blur-3xl" />
        <div className="absolute left-1/3 bottom-0 h-48 w-48 rounded-full bg-brand-400/8 blur-2xl" />

        {/* Content */}
        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20 ring-1 ring-brand-400/30">
              <Plane className="h-5 w-5 text-brand-300" />
            </span>
            <div>
              <div className="text-[17px] font-bold tracking-tight text-white">TRIP FLY BD</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-400/70">
                Enterprise Resource Planning
              </div>
            </div>
          </div>

          {/* Hero */}
          <div>
            <h1 className="max-w-md text-3xl font-bold leading-[1.25] text-white xl:text-4xl">
              Every taka accounted for.<br />Every booking, balanced.
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-100/55">
              Double-entry accounting, travel bookings, inventory, CRM, HR &amp; payroll —
              one ledger of truth for the whole agency.
            </p>

            {/* Feature checklist */}
            <ul className="mt-7 space-y-2.5">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-brand-100/70">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-brand-400" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="text-[11px] text-brand-400/40">© {new Date().getFullYear()} Trip Fly BD · Dhaka, Bangladesh</div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[380px]">

          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700">
              <Plane className="h-4 w-4 text-brand-200" />
            </span>
            <span className="text-lg font-bold">TRIP FLY BD</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Sign in with your company credentials.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block">
              <span className="label">Email address</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  className="input pl-10"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
            </label>

            <label className="block">
              <span className="label">Password</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  className="input pl-10"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </label>

            <ErrorNote message={error} />

            <button className="btn-primary w-full py-3" disabled={busy}>
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>
          </form>

          {/* Test accounts */}
          <div className="mt-7 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
            <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">
                Demo accounts
              </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {SEEDED.map((s) => (
                <button
                  key={s.email}
                  type="button"
                  onClick={() => { setEmail(s.email); setPassword(s.pass); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${s.color} text-[11px] font-bold text-white`}>
                    {s.role[0]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{s.role}</div>
                    <div className="num truncate text-xs text-slate-400 dark:text-slate-500">{s.email}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
