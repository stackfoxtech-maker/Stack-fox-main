import { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import AppRoutes from './routes';
import useAuthStore from '@store/authStore';
import useCartStore from '@store/cartStore';
import CartDrawer from '@components/ui/CartDrawer';

export default function App() {
  const { isAuthenticated, fetchMe } = useAuthStore();
  const { fetchCart, syncLocalToServer } = useCartStore();

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
    <MotionConfig reducedMotion="user" transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}>
      <AppRoutes />
      <CartDrawer />
    </MotionConfig>
  );
}

