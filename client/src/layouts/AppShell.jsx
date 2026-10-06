import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Briefcase,
  ClipboardCheck,
  CreditCard,
  FolderKanban,
  Gauge,
  Handshake,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  PlusCircle,
  Search,
  Settings,
  SlidersHorizontal,
  Trophy,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { Pill } from '../components/ui';
import Avatar from '../components/Avatar';

const NAV = {
  graduate: [
    {
      section: 'Workspace',
      items: [
        { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/app/projects', label: 'My Projects', icon: FolderKanban, end: true },
        { to: '/app/projects/new', label: 'Submit a Project', icon: PlusCircle },
        { to: '/app/introductions', label: 'Investor Introductions', icon: Handshake },
        { to: '/app/opportunities', label: 'Funding Opportunities', icon: Trophy },
      ],
    },
  ],
  investor: [
    {
      section: 'Investor',
      items: [
        { to: '/app/discover', label: 'Browse Projects', icon: Search },
        { to: '/app/introductions', label: 'My Introductions', icon: Handshake },
        { to: '/app/billing', label: 'Billing & Premium', icon: CreditCard },
      ],
    },
  ],
  admin: [
    {
      section: 'Administration',
      items: [
        { to: '/app/admin', label: 'Dashboard', icon: Gauge, end: true },
        { to: '/app/admin/graduates', label: 'Graduate Approvals', icon: UserCheck },
        { to: '/app/admin/investors', label: 'Investor Approvals', icon: Users },
        { to: '/app/admin/projects', label: 'Project Verification', icon: ClipboardCheck },
        { to: '/app/admin/opportunities', label: 'Opportunities', icon: Trophy },
      ],
    },
    {
      section: 'Platform',
      items: [
        { to: '/app/admin/outbox', label: 'Email Outbox', icon: Mail },
        { to: '/app/admin/config', label: 'Rules & Thresholds', icon: SlidersHorizontal },
      ],
    },
  ],
  staff: [
    {
      section: 'Workspace console',
      items: [
        { to: '/app/staff', label: 'Hackathons & Opportunities', icon: Trophy, end: true },
        { to: '/app/staff/selection', label: 'Staff Selection', icon: Briefcase },
      ],
    },
  ],
};

const ROLE_LABEL = { graduate: 'Graduate', investor: 'Investor / Sponsor', admin: 'Administrator', staff: 'ALU Staff' };

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);

  const sections = NAV[user.role] || [];
  const signOut = async () => {
    await logout();
    navigate('/signin');
  };

  const sidebar = (
    <nav className="flex h-full flex-col gap-6 p-3" aria-label="Dashboard">
      {sections.map((section) => (
        <div key={section.section}>
          <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted">{section.section}</p>
          <ul className="space-y-0.5">
            {section.items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      isActive ? 'bg-accent-soft font-medium text-accent' : 'text-ink hover:bg-subtle'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div>
        <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted">Account</p>
        <NavLink
          to="/app/settings"
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${isActive ? 'bg-accent-soft font-medium text-accent' : 'text-ink hover:bg-subtle'}`
          }
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          Settings
        </NavLink>
      </div>
      <div className="mt-auto rounded-md border border-line p-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
          All platform services are free
        </span>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface px-3 sm:px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md p-2 text-muted hover:bg-subtle lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Logo to="/" />
        </div>
        <div className="flex items-center gap-3">
          {user.approved ? (
            <Pill tone="green" className="hidden sm:inline-flex">
              <BadgeCheck className="h-3 w-3" aria-hidden="true" /> Verified {ROLE_LABEL[user.role]}
            </Pill>
          ) : (
            <Pill tone="amber" className="hidden sm:inline-flex">
              Pending review
            </Pill>
          )}
          <div className="flex items-center gap-2">
            <Avatar name={user.fullName} src={user.hasPhoto ? '/api/account/photo' : null} />
            <div className="hidden leading-tight md:block">
              <p className="text-sm font-medium">{user.fullName}</p>
              <p className="text-xs text-muted">{ROLE_LABEL[user.role]}</p>
            </div>
          </div>
          <button type="button" onClick={signOut} className="btn-secondary" aria-label="Sign out">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-line bg-surface lg:block">
          {sidebar}
        </aside>
        {open && (
          <div className="fixed inset-0 top-14 z-20 lg:hidden">
            <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close navigation" onClick={() => setOpen(false)} />
            <aside className="relative h-full w-64 overflow-y-auto border-r border-line bg-surface">{sidebar}</aside>
          </div>
        )}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
