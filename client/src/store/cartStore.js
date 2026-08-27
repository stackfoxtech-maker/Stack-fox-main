import { create } from 'zustand';
import api from '@lib/api';
import toast from 'react-hot-toast';

const useCartStore = create((set, get) => ({
  items: [],
  subtotal: 0,
  gstRate: 18,
  gstAmount: 0,
  total: 0,
  itemCount: 0,
  isLoading: false,
  isOpen: false,
  // Metadata for advanced features
  curIdx: 0,
  warnings: [],
  roiItems: [],

  setCurIdx: (curIdx) => set({ curIdx }),
  setMetadata: (metadata) => set({ 
    warnings: metadata.warnings || [], 
    roiItems: metadata.roiItems || [] 
  }),


  setOpen: (open) => set({ isOpen: open }),
  toggleCart: () => set((s) => ({ isOpen: !s.isOpen })),

  // Sync from API response
  syncFromApi: (cartData) => {
    set({
      items: cartData.items || [],
      subtotal: cartData.subtotal || 0,
      gstRate: cartData.gstRate || 18,
      gstAmount: cartData.gstAmount || 0,
      total: cartData.total || 0,
      itemCount: cartData.itemCount || 0,
    });
  },

  // Local-only cart for non-authenticated users
  localAdd: (item) => {
    const items = [...get().items];
    const idx = items.findIndex((i) => i.itemId === item.itemId && i.itemType === item.itemType);

    if (idx >= 0) {
      items[idx].quantity = Math.min(99, items[idx].quantity + (item.quantity || 1));
    } else {
      items.push({
        _id: `local-${Date.now()}`,
        itemId: item.itemId,
        itemType: item.itemType,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        notes: item.notes || '',
      });
    }

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const gstAmount = Math.round(subtotal * 0.18);

    set({
      items,
      subtotal,
      gstAmount,
      total: subtotal + gstAmount,
      itemCount: items.reduce((c, i) => c + i.quantity, 0),
      isOpen: true,
    });

    toast.success('Added to cart');
  },

  localRemove: (localId) => {
    const items = get().items.filter((i) => i._id !== localId);
    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const gstAmount = Math.round(subtotal * 0.18);

    set({
      items,
      subtotal,
      gstAmount,
      total: subtotal + gstAmount,
      itemCount: items.reduce((c, i) => c + i.quantity, 0),
    });
  },

  localClear: () => {
    set({ items: [], subtotal: 0, gstAmount: 0, total: 0, itemCount: 0 });
  },

  // API-backed cart operations
  fetchCart: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get('/cart');
      get().syncFromApi(res.data.data.cart);
    } catch {
      // Silently fail — user might not be logged in
    } finally {
      set({ isLoading: false });
    }
  },

  addItem: async (item, isAuthenticated) => {
    if (!isAuthenticated) {
      get().localAdd(item);
      return;
    }

    set({ isLoading: true });
    try {
      const res = await api.post('/cart/add', item);
      get().syncFromApi(res.data.data.cart);
      set({ isOpen: true });
      toast.success('Added to cart');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add item.');
    } finally {
      set({ isLoading: false });
    }
  },

  removeItem: async (cartItemId, isAuthenticated) => {
    if (!isAuthenticated) {
      get().localRemove(cartItemId);
      return;
    }

    set({ isLoading: true });
    try {
      const res = await api.post('/cart/remove', { cartItemId });
      get().syncFromApi(res.data.data.cart);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove item.');
    } finally {
      set({ isLoading: false });
    }
  },

  updateQuantity: async (cartItemId, quantity, isAuthenticated) => {
    if (!isAuthenticated) {
      const items = get().items.map((i) =>
        i._id === cartItemId ? { ...i, quantity: Math.max(1, Math.min(99, quantity)) } : i
      );
      const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
      const gstAmount = Math.round(subtotal * 0.18);
      set({ items, subtotal, gstAmount, total: subtotal + gstAmount, itemCount: items.reduce((c, i) => c + i.quantity, 0) });
      return;
    }

    try {
      const res = await api.post('/cart/update-quantity', { cartItemId, quantity });
      get().syncFromApi(res.data.data.cart);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update quantity.');
    }
  },

  clearCart: async (isAuthenticated) => {
    if (!isAuthenticated) {
      get().localClear();
      return;
    }

    try {
      const res = await api.post('/cart/clear');
      get().syncFromApi(res.data.data.cart);
      toast.success('Cart cleared.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to clear cart.');
    }
  },

  // Sync local cart to server after login
  syncLocalToServer: async () => {
    const localItems = get().items.filter((i) => i._id?.startsWith('local-'));
    if (localItems.length === 0) return;

    for (const item of localItems) {
      try {
        await api.post('/cart/add', {
          itemId: item.itemId,
          itemType: item.itemType,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          notes: item.notes,
        });
      } catch {
        // Skip items that fail
      }
    }

    await get().fetchCart();
  },
}));

export default useCartStore;
