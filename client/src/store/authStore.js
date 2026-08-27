import { create } from 'zustand';
import api from '@lib/api';
import toast from 'react-hot-toast';

/**
 * Persists a freshly minted session.
 *
 * The refresh token has to be stored too: /auth/refresh-token compares the
 * presented token against the one on record, so sending the access token there
 * (as this app used to) could never succeed and every session died at 24h.
 */
export const storeTokens = ({ accessToken, refreshToken }) => {
  if (accessToken) localStorage.setItem('sf_access_token', accessToken);
  if (refreshToken) localStorage.setItem('sf_refresh_token', refreshToken);
};

export const clearTokens = () => {
  localStorage.removeItem('sf_access_token');
  localStorage.removeItem('sf_refresh_token');
  localStorage.removeItem('sf_user');
};

const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('sf_user') || 'null'),
  isAuthenticated: Boolean(localStorage.getItem('sf_access_token')),
  isLoading: false,

  setUser: (user) => {
    if (user) {
      localStorage.setItem('sf_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('sf_user');
    }
    set({ user, isAuthenticated: Boolean(user) });
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/register', data);
      const { user, accessToken, refreshToken } = res.data.data;
      storeTokens({ accessToken, refreshToken });
      get().setUser(user);
      toast.success('Account created! Please verify your email.');
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed.';
      toast.error(msg);
      return { success: false, message: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { user, accessToken, refreshToken } = res.data.data;
      storeTokens({ accessToken, refreshToken });
      get().setUser(user);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      return { success: true, user };
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed.';
      toast.error(msg);
      return { success: false, message: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Finishes a Google sign-in. The redirect only carries tokens, so the profile
   * is fetched with them — which also proves the token works before we send the
   * user to a dashboard that would otherwise bounce them straight back.
   */
  completeOAuthLogin: async ({ accessToken, refreshToken }) => {
    set({ isLoading: true });
    try {
      storeTokens({ accessToken, refreshToken });
      const user = await get().fetchMe();
      if (!user) {
        clearTokens();
        set({ user: null, isAuthenticated: false });
        return { success: false, message: 'Your sign-in could not be verified.' };
      }
      toast.success(`Welcome, ${user.name.split(' ')[0]}!`);
      return { success: true, user };
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore — clear local state regardless
    }
    clearTokens();

    // Also clear the local cart state
    try {
      const { localClear } = (await import('./cartStore')).default.getState();
      localClear();
    } catch (e) {
      console.warn('Could not clear cart on logout', e);
    }

    set({ user: null, isAuthenticated: false });
    toast.success('Logged out.');
  },

  fetchMe: async () => {
    try {
      const res = await api.get('/auth/me');
      get().setUser(res.data.data.user);
      return res.data.data.user;
    } catch (err) {
      // Only clear the session on a real auth failure (401/403) — a
      // transient network error or server 500 should not log the user out.
      if (err.response?.status === 401 || err.response?.status === 403) {
        get().setUser(null);
        clearTokens();
      }
      return null;
    }
  },

  updateProfile: async (data) => {
    set({ isLoading: true });
    try {
      const res = await api.put('/users/me', data);
      get().setUser(res.data.data.user);
      toast.success('Profile updated.');
      return { success: true };
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed.');
      return { success: false };
    } finally {
      set({ isLoading: false });
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    set({ isLoading: true });
    try {
      await api.put('/users/me/password', { currentPassword, newPassword });
      toast.success('Password changed. Please log in again.');
      get().logout();
      return { success: true };
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password change failed.');
      return { success: false };
    } finally {
      set({ isLoading: false });
    }
  },

  forgotPassword: async (email) => {
    set({ isLoading: true });
    try {
      await api.post('/auth/forgot-password', { email });
      toast.success('If an account exists, a reset link has been sent.');
      return { success: true };
    } catch (err) {
      // A 404-style "no such account" is never returned here — the endpoint
      // answers identically either way so it cannot enumerate accounts. What
      // does surface is the mail provider or session store being down, and
      // telling the user "check your email" then would strand them.
      const status = err.response?.status;
      if (status === 502 || status === 503) {
        const msg = err.response?.data?.message || 'We could not send the reset email. Please try again shortly.';
        toast.error(msg);
        return { success: false, message: msg };
      }
      toast.error('We could not send the reset email. Please try again shortly.');
      return { success: false, message: 'We could not send the reset email. Please try again shortly.' };
    } finally {
      set({ isLoading: false });
    }
  },

  resetPassword: async (token, password) => {
    set({ isLoading: true });
    try {
      await api.post('/auth/reset-password', { token, password });
      toast.success('Password reset! Please log in.');
      return { success: true };
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed.');
      return { success: false };
    } finally {
      set({ isLoading: false });
    }
  },

  verifyEmail: async (token) => {
    try {
      await api.post('/auth/verify-email', { token });
      const user = get().user;
      if (user) {
        get().setUser({ ...user, isEmailVerified: true });
      }
      toast.success('Email verified!');
      return { success: true };
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed.');
      return { success: false };
    }
  },

  // Helper getters
  isAdmin: () => ['admin', 'ADMIN'].includes(get().user?.role),
  isTeam: () => ['team', 'TEAM', 'SE', 'SENIOR_PM', 'PM', 'DEVELOPER', 'QA', 'DESIGNER', 'DEVOPS'].includes(get().user?.role),
  isClient: () => ['client', 'CLIENT', 'CLIENT_ADMIN', 'CLIENT_PM', 'CLIENT_VIEWER', 'INDIVIDUAL_CLIENT', 'ORG_OWNER'].includes(get().user?.role),

  // Single source of truth for "which dashboard does this role land on" —
  // role strings are inconsistently cased across the app (ADMIN vs team),
  // so this must go through the role-family checks above, never a bare
  // `role === 'admin'` comparison (that silently sends every real admin,
  // whose role is "ADMIN", to the client dashboard instead).
  getDashboardPath: () => {
    if (get().isAdmin()) return '/app/admin';
    if (get().isTeam()) return '/app/team';
    return '/app/client';
  },
}));

export default useAuthStore;
