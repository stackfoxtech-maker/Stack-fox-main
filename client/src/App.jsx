import { lazy, Suspense, useEffect, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import AppRoutes from './routes';
import useAuthStore from '@store/authStore';
import useCartStore from '@store/cartStore';

// Deferred: the cart drawer (and its estimate/pricing deps) only matters once
// the visitor has a cart or opens it — no reason to ship it on the landing page.
const CartDrawer = lazy(() => import('@components/ui/CartDrawer'));

export default function App() {
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
      <AppRoutes />
      {cartActive && (
        <Suspense fallback={null}>
          <CartDrawer />
        </Suspense>
      )}
    </MotionConfig>
  );
}
