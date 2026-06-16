import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpenText, Boxes, Users, Plane,
  BadgeDollarSign, BarChart3, Settings, Moon, Sun,
  LogOut, Menu, X, ReceiptText, Wallet, Database,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

// ── Navigation groups ──────────────────────────────────────────────────────

interface NavConfigItem {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
  roles?: string[];
}

const NAV_GROUPS: { label: string; items: NavConfigItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/accounting', label: 'Accounting',  icon: BookOpenText },
      { to: '/invoices',   label: 'Invoices',    icon: ReceiptText },
      { to: '/payments',   label: 'Payments',    icon: Wallet },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/bookings',  label: 'Travel Bookings', icon: Plane },
      { to: '/inventory', label: 'Inventory',        icon: Boxes },
      { to: '/crm',       label: 'CRM',              icon: Users },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/hr', label: 'HR & Payroll', icon: BadgeDollarSign },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/reports',  label: 'Reports',  icon: BarChart3 },
      { to: '/database', label: 'Database', icon: Database, roles: ['ADMIN'] },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

// ── NavItem ────────────────────────────────────────────────────────────────

function NavItem({
  to, label, icon: Icon, end, onClick,
}: {
  to: string; label: string;
  icon: React.ElementType;
  end?: boolean; onClick?: () => void;
}) {
  return (
    <NavLink
      to={to} end={end} onClick={onClick}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${
          isActive
            ? 'bg-white/[0.13] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.07)]'
            : 'text-brand-100/55 hover:bg-white/[0.07] hover:text-brand-100/90'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={`h-[17px] w-[17px] flex-shrink-0 transition-colors ${
              isActive ? 'text-brand-300' : 'text-brand-400/50 group-hover:text-brand-300/80'
            }`}
          />
          <span className="flex-1 truncate">{label}</span>
          {isActive && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-400" />}
        </>
      )}
    </NavLink>
  );
}

// ── Sidebar body ───────────────────────────────────────────────────────────

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();

  return (
    <div className="flex h-full flex-col">

      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500/20 ring-1 ring-brand-400/25">
            <Plane className="h-[18px] w-[18px] text-brand-300" />
          </div>
          <div>
            <div className="text-[15px] font-bold leading-none tracking-tight text-white">Trip Fly BD</div>
            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-brand-400/60">
              Enterprise ERP
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-white/[0.07]" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-2' : ''}>
            <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-400/35">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items
                .filter((item) => !item.roles || item.roles.includes(user?.role ?? ''))
                .map((item) => (
                  <NavItem key={item.to} {...item} onClick={onNavigate} />
                ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.07] px-5 py-3">
        <div className="text-[10px] font-medium text-brand-400/35">v1.0 · Dhaka, Bangladesh</div>
      </div>
    </div>
  );
}

// ── AppShell ───────────────────────────────────────────────────────────────

export default function AppShell() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const [drawer, setDrawer] = useState(false);
  const navigate = useNavigate();

  const initial = user?.name?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="flex min-h-screen">

      {/* ── Desktop sidebar ── */}
      <aside
        className="sticky top-0 hidden h-screen w-[244px] flex-shrink-0 flex-col lg:flex"
        style={{ background: 'linear-gradient(175deg, #042f2e 0%, #061a18 55%, #060f0e 100%)' }}
      >
        <SidebarBody />
      </aside>

      {/* ── Mobile drawer ── */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setDrawer(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 w-[244px] flex-col animate-slide-in"
            style={{ background: 'linear-gradient(175deg, #042f2e 0%, #061a18 55%, #060f0e 100%)' }}
          >
            <button
              className="absolute right-3 top-4 rounded-lg p-1.5 text-brand-200/60 hover:bg-white/10 hover:text-white transition-colors"
              onClick={() => setDrawer(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarBody onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-slate-950/85 px-4 backdrop-blur-xl">
          <button
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1" />

          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="btn-icon"
            aria-label="Toggle dark mode"
          >
            {dark ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
          </button>

          {/* User info */}
          <div className="hidden items-center gap-3 sm:flex">
            <div className="text-right">
              <div className="text-sm font-semibold leading-tight">{user?.name}</div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                {user?.role}
              </div>
            </div>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-[13px] font-bold text-white ring-2 ring-brand-500/20">
              {initial}
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={async () => { await logout(); navigate('/login'); }}
            className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 transition-all"
            aria-label="Log out"
          >
            <LogOut className="h-[17px] w-[17px]" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
