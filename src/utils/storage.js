/**
 * Safe local storage wrapper
 */

const STORAGE_KEYS = {
  AUTH_USER: 'roomtrail_auth_user',
  AUTH_TOKEN: 'roomtrail_auth_token',
  THEME: 'roomtrail_theme',
  SIDEBAR_COLLAPSED: 'roomtrail_sidebar_collapsed',
};

export const storage = {
  getUser: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('Failed to read user from storage', err);
      return null;
    }
  },

  setUser: (user) => {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
      }
    } catch (err) {
      console.error('Failed to persist user in storage', err);
    }
  },

  getToken: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch {
      return null;
    }
  },

  setToken: (token) => {
    try {
      if (token) {
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      } else {
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      }
    } catch (err) {
      console.error('Failed to persist token', err);
    }
  },

  clearAuth: () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch (err) {
      console.error('Failed to clear auth storage', err);
    }
  },

  getSidebarCollapsed: () => {
    try {
      return localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
    } catch {
      return false;
    }
  },

  setSidebarCollapsed: (isCollapsed) => {
    try {
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(isCollapsed));
    } catch (err) {
      console.error('Failed to set sidebar preference', err);
    }
  },
};
