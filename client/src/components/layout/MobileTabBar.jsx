import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
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
    'relative flex min-h-[3.5rem] flex-1 select-none flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold transition-colors',
    active ? 'text-fox-600' : 'text-warm-500',
  );

/** The soft pill that slides behind whichever tab is active. */
function Pill() {
  return (
    <motion.span
      layoutId="tab-pill"
      aria-hidden
      className="absolute inset-x-1.5 inset-y-1 rounded-2xl bg-fox-50"
      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
    />
  );
}

const Tab = ({ active, icon: Icon, children, badge }) => (
  <>
    {active && <Pill />}
    <motion.span
      className="relative flex flex-col items-center gap-0.5"
      whileTap={{ scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
    >
      <span className="relative">
        <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
        {badge > 0 && (
          <motion.span
            key={badge}
            initial={{ scale: 0.4 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 14 }}
            className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-fox-500 px-1 text-[10px] font-bold text-white ring-2 ring-white"
          >
            {badge > 99 ? '99+' : badge}
          </motion.span>
        )}
      </span>
      {children}
    </motion.span>
  </>
);

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
        style={{ height: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
      />
      {/* A floating bar, inset from the screen edge, in place of a full-width strip. */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-3 z-40 flex rounded-[1.6rem] border border-warm-200/80 bg-white/90 p-1 shadow-[0_10px_32px_-8px_rgba(26,25,24,0.28)] backdrop-blur-xl lg:hidden"
        style={{ bottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        {tabs.map(({ label, icon, to, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => tabClass(isActive)}>
            {({ isActive }) => (
              <Tab active={isActive} icon={icon}>
                {label}
              </Tab>
            )}
          </NavLink>
        ))}

        <button
          type="button"
          onClick={toggleCart}
          aria-label={`Cart, ${itemCount} items`}
          className={tabClass(false)}
        >
          <Tab active={false} icon={ShoppingCart} badge={itemCount}>
            Cart
          </Tab>
        </button>

        <NavLink
          to={isAuthenticated ? getDashboardPath() : '/login'}
          className={({ isActive }) => tabClass(isActive && isAuthenticated)}
        >
          {({ isActive }) => (
            <Tab active={isActive && isAuthenticated} icon={User}>
              {isAuthenticated ? 'Account' : 'Log in'}
            </Tab>
          )}
        </NavLink>
      </nav>
    </>
  );
}
