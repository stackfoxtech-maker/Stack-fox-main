import { NavLink, useLocation } from 'react-router-dom';
import { Home, Hammer, Package, ShoppingCart, User } from 'lucide-react';
import { cn } from '@lib/utils';
import useAuthStore from '@store/authStore';
import useCartStore from '@store/cartStore';

const HIDDEN_ON = [
  '/app/',
  '/checkout',
  '/esign',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
];

export const tabBarVisible = (pathname) => !HIDDEN_ON.some((p) => pathname.startsWith(p));

const tabClass = (active) =>
  cn(
    'relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors active:scale-95',
    active ? 'text-fox-600' : 'text-warm-500',
  );

function Indicator({ active }) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute left-1/2 top-0 h-0.5 -translate-x-1/2 rounded-full bg-fox-500 transition-all duration-medium ease-enter',
        active ? 'w-8 opacity-100' : 'w-0 opacity-0',
      )}
    />
  );
}

export default function MobileTabBar() {
  const { pathname } = useLocation();
  const { isAuthenticated, getDashboardPath } = useAuthStore();
  const { itemCount, toggleCart } = useCartStore();

  if (!tabBarVisible(pathname)) return null;

  const tabs = [
    { label: 'Home', icon: Home, to: '/', end: true },
    { label: 'Builder', icon: Hammer, to: '/builder' },
    { label: 'Packages', icon: Package, to: '/packages' },
  ];

  return (
    <>
      <div
        aria-hidden
        className="lg:hidden"
        style={{ height: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
      />
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-warm-200 bg-white/95 shadow-[0_-6px_24px_-12px_rgba(26,25,24,0.18)] backdrop-blur-lg lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map(({ label, icon: Icon, to, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => tabClass(isActive)}>
            {({ isActive }) => (
              <>
                <Indicator active={isActive} />
                <Icon size={21} strokeWidth={isActive ? 2.4 : 2} />
                {label}
              </>
            )}
          </NavLink>
        ))}

        <button
          type="button"
          onClick={toggleCart}
          aria-label={`Cart, ${itemCount} items`}
          className={tabClass(false)}
        >
          <span className="relative">
            <ShoppingCart size={21} />
            {itemCount > 0 && (
              <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-fox-500 px-1 text-[9px] font-bold text-white">
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </span>
          Cart
        </button>

        <NavLink
          to={isAuthenticated ? getDashboardPath() : '/login'}
          className={({ isActive }) => tabClass(isActive && isAuthenticated)}
        >
          <User size={21} />
          {isAuthenticated ? 'Account' : 'Log in'}
        </NavLink>
      </nav>
    </>
  );
}
