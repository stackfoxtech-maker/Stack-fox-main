import { lazy, Suspense, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, X, Search, Bell, MoreHorizontal } from 'lucide-react';
import { cn } from '@lib/utils';
import { BrandLogo } from '@components/ui/BrandLogo';
import useAuthStore from '@store/authStore';

const SearchOverlay = lazy(() => import('@components/ui/SearchOverlay'));

/**
 * One shell for every dashboard (client / admin / team / sales).
 *
 * Desktop (lg+): the classic static left sidebar + slim top header.
 * Mobile: a card-app layout — top app bar (logo · title · search · alerts),
 * a scrollable content area, and a fixed bottom tab bar (4 primary
 * destinations + "More", which opens the full nav as a drawer).
 *
 * Props:
 *   title      dashboard name shown in both bars
 *   navItems   [{ label, icon, path }]  — full list (sidebar + More drawer)
 *   tabItems   4 items for the bottom bar; defaults to the first 4 navItems
 *   dark       dark sidebar treatment (admin)
 *   accentPath extra path considered "active" for a tab (optional)
 */
export default function DashboardShell({ title, navItems, tabItems, dark = false }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchMounted, setSearchMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const tabs = (tabItems && tabItems.length ? tabItems : navItems.slice(0, 4));
  const base = navItems[0]?.path || '/';
  const notifPath = navItems.find((i) => /notification|alert/i.test(i.label))?.path;
  const openSearch = () => { setSearchMounted(true); setSearchOpen(true); };

  const isActive = (path) =>
    path === base ? location.pathname === base : location.pathname.startsWith(path);

  const currentLabel =
    [...navItems].reverse().find((i) => isActive(i.path))?.label || title;

  const NavList = ({ onNavigate }) => (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === base}
          onClick={onNavigate}
          className={({ isActive: a }) => cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
            a
              ? dark ? 'bg-fox-500/15 text-fox-400' : 'bg-fox-50 text-fox-600'
              : dark ? 'text-warm-300 hover:bg-white/5 hover:text-white'
                     : 'text-warm-600 hover:bg-warm-50 hover:text-warm-900',
          )}
        >
          <item.icon size={18} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  const UserBlock = () => (
    <div className={cn('border-t px-3 py-4', dark ? 'border-white/10' : 'border-warm-100')}>
      <div className="mb-2 flex items-center gap-3 px-3 py-2">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-fox-100 text-sm font-medium text-fox-700">
          {user?.name?.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-sm font-medium', dark ? 'text-white' : 'text-warm-900')}>{user?.name}</p>
          <p className={cn('truncate text-[11px]', dark ? 'text-warm-400' : 'text-warm-500')}>{user?.email}</p>
        </div>
      </div>
      <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-danger-500 transition-colors hover:bg-danger-50">
        <LogOut size={18} /> Log out
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-warm-50">
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className={cn(
        'hidden w-64 flex-col border-r lg:flex',
        dark ? 'border-warm-800 bg-warm-900' : 'border-warm-200 bg-white',
      )}>
        <div className={cn('flex h-16 items-center px-5', dark ? 'border-b border-warm-800' : 'border-b border-warm-100')}>
          <NavLink to="/" className="flex items-center gap-2">
            <BrandLogo size={22} withBackground />
            <span className={cn('font-semibold', dark ? 'text-white' : 'text-warm-900')}>
              stack<span className="text-fox-500">fox</span>
            </span>
          </NavLink>
        </div>
        <NavList />
        <UserBlock />
      </aside>

      {/* ── Mobile drawer (the "More" sheet) ────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-warm-900/40 backdrop-blur-sm" />
          <aside
            className={cn(
              'absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col animate-slide-in-left',
              dark ? 'bg-warm-900' : 'bg-white',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={cn('flex h-16 items-center justify-between px-5', dark ? 'border-b border-warm-800' : 'border-b border-warm-100')}>
              <span className={cn('font-semibold', dark ? 'text-white' : 'text-warm-900')}>
                stack<span className="text-fox-500">fox</span>
              </span>
              <button onClick={() => setDrawerOpen(false)} className={cn('rounded-lg p-1.5', dark ? 'hover:bg-white/10 text-warm-300' : 'hover:bg-warm-100')}>
                <X size={18} />
              </button>
            </div>
            <NavList onNavigate={() => setDrawerOpen(false)} />
            <UserBlock />
          </aside>
        </div>
      )}

      {/* ── Main column ─────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top app bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-warm-200 bg-white/90 px-4 backdrop-blur-md lg:h-16 lg:px-6">
          <span className="lg:hidden"><BrandLogo size={22} withBackground /></span>
          <h1 className="flex-1 truncate text-base font-semibold text-warm-900 lg:text-lg">
            <span className="lg:hidden">{currentLabel}</span>
            <span className="hidden lg:inline">{title}</span>
          </h1>
          <button onClick={openSearch} aria-label="Search services" className="grid h-9 w-9 place-items-center rounded-lg text-warm-600 hover:bg-warm-100">
            <Search size={19} />
          </button>
          {notifPath && (
            <NavLink to={notifPath} aria-label="Notifications" className="grid h-9 w-9 place-items-center rounded-lg text-warm-600 hover:bg-warm-100">
              <Bell size={19} />
            </NavLink>
          )}
        </header>

        {/* Scrollable content — pad past the fixed bottom bar on mobile */}
        <main className="flex-1 overflow-y-auto p-4 pb-24 lg:p-6 lg:pb-6">
          <Outlet />
        </main>

        {/* Fixed bottom tab bar (mobile only) */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-warm-200 bg-white/95 backdrop-blur-md lg:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {tabs.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === base}
              className={({ isActive: a }) => cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                a ? 'text-fox-600' : 'text-warm-500',
              )}
            >
              <item.icon size={20} strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
          <button
            onClick={() => setDrawerOpen(true)}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
              drawerOpen ? 'text-fox-600' : 'text-warm-500',
            )}
          >
            <MoreHorizontal size={20} strokeWidth={2} />
            More
          </button>
        </nav>
      </div>

      {searchMounted && (
        <Suspense fallback={null}>
          <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
