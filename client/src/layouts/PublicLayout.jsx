import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth, homePathFor } from '../context/AuthContext';

const LINKS = [
  { to: '/ventures', label: 'Browse Ventures' },
  { to: '/verify', label: 'Verify a Project' },
  { to: '/opportunities', label: 'Opportunities' },
];

// Dark public site frame from the Figma home / sign-in screens.
export default function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[#0d1117] text-[#e6edf3]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0d1117]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-8">
            <Logo productClass="text-white" />
            <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
              {LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    `text-sm transition-colors ${isActive ? 'text-white' : 'text-[#9198a1] hover:text-white'}`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <Link to={homePathFor(user)} className="btn-cta">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link to="/signin" className="text-sm text-[#9198a1] hover:text-white">
                  Sign in
                </Link>
                <Link to="/register" className="btn-cta">
                  Get Started
                </Link>
              </>
            )}
          </div>
          <button
            type="button"
            className="rounded-md p-2 text-[#9198a1] hover:text-white md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <nav className="border-t border-white/10 px-4 py-3 md:hidden" aria-label="Mobile">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="block py-2 text-sm text-[#c9d1d9]">
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2 border-t border-white/10 pt-3">
              {user ? (
                <Link to={homePathFor(user)} className="btn-cta flex-1" onClick={() => setOpen(false)}>
                  Open dashboard
                </Link>
              ) : (
                <>
                  <Link to="/signin" className="btn flex-1 border-white/20 text-white" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                  <Link to="/register" className="btn-cta flex-1" onClick={() => setOpen(false)}>
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-white/10 bg-[#010409]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-[#9198a1] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} African Leadership University · ALU Graduate Entrepreneurship &amp; Funding Platform</p>
          <p>Free for graduates, investors and sponsors. Verification status is not an investment guarantee.</p>
        </div>
      </footer>
    </div>
  );
}
