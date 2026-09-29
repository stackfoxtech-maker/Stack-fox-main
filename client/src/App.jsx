import { lazy, Suspense, useEffect, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { useLocation, useNavigationType } from 'react-router-dom';
import AppRoutes from './routes';
import useAuthStore from '@store/authStore';
import useCartStore from '@store/cartStore';

// Deferred: the cart drawer (and its estimate/pricing deps) only matters once
// the visitor has a cart or opens it — no reason to ship it on the landing page.
const CartDrawer = lazy(() => import('@components/ui/CartDrawer'));
// The assistant loads after the page is interactive and stays out of sign-in, payment and
// staff screens, where a floating sales bot only gets in the way.
const FoxBot = lazy(() => import('@components/ui/FoxBot').then((m) => ({ default: m.FoxBot })));
const NO_BOT =
  /^\/(login|signup|forgot-password|reset-password|verify-email|esign|checkout|payment-confirmation|oauth|app\/(admin|team))/;

/* A new page opens at its top. Without this the browser keeps the old scroll position, so
   tapping a link from the footer opened the next page at ITS footer. Back/forward (POP)
   is left alone so the browser can restore where the person was; a #hash scrolls to its target. */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const type = useNavigationType();
  useEffect(() => {
    if (type === 'POP' || hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash, type]);
  return null;
}

export default function App() {
  const { pathname } = useLocation();
  const { isAuthenticated, fetchMe } = useAuthStore();
  const { fetchCart, syncLocalToServer } = useCartStore();
  const isOpen = useCartStore((s) => s.isOpen);
  const itemCount = useCartStore((s) => s.itemCount);

  // Once the cart has been touched, keep the drawer mounted for the session.
  const [cartActive, setCartActive] = useState(false);
  useEffect(() => {
    if (!cartActive && (isOpen || itemCount > 0)) setCartActive(true);
  }, [isOpen, itemCount, cartActive]);

  // On mount: verify auth state
  useEffect(() => {
    if (isAuthenticated) {
      fetchMe();
    }
  }, []);

  // When auth state changes: sync cart
  useEffect(() => {
    if (isAuthenticated) {
      syncLocalToServer().then(() => fetchCart());
    }
  }, [isAuthenticated]);

  return (
    <MotionConfig reducedMotion="user">
      <ScrollToTop />
      <AppRoutes />
      {!NO_BOT.test(pathname) && (
        <Suspense fallback={null}>
          <FoxBot />
        </Suspense>
      )}
      {cartActive && (
        <Suspense fallback={null}>
          <CartDrawer />
        </Suspense>
      )}
    </MotionConfig>
  );
}
