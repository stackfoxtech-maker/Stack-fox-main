import { create } from 'zustand';

const useUiStore = create((set) => ({
  // Mobile menu
  isMobileMenuOpen: false,
  toggleMobileMenu: () => set((s) => ({ isMobileMenuOpen: !s.isMobileMenuOpen })),
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),

  // Sidebar (dashboards)
  isSidebarOpen: true,
  isSidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  collapseSidebar: () => set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),
  closeSidebar: () => set({ isSidebarOpen: false }),

  // Global search
  isSearchOpen: false,
  toggleSearch: () => set((s) => ({ isSearchOpen: !s.isSearchOpen })),
  closeSearch: () => set({ isSearchOpen: false }),

  // Modal system
  activeModal: null,
  modalData: null,
  openModal: (name, data = null) => set({ activeModal: name, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),

  // Scroll state
  isScrolled: false,
  setScrolled: (val) => set({ isScrolled: val }),

  // Page transition
  isPageLoading: false,
  setPageLoading: (val) => set({ isPageLoading: val }),

  // Multi-Currency
  curIdx: 0,
  setCurIdx: (idx) => set({ curIdx: idx }),
}));

export default useUiStore;
