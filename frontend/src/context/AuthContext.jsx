import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { storage } from '../utils/storage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => storage.getUser());
  const [token, setToken] = useState(() => storage.getToken());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sync session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedUser = storage.getUser();
      const storedToken = storage.getToken();

      if (storedUser && storedToken) {
        try {
          // Fetch fresh user data from API
          const freshUser = await authService.getUserById(storedUser.id);
          setUser(freshUser);
          setToken(storedToken);
        } catch (err) {
          console.warn('Could not refresh session from API, using cached profile', err);
          setUser(storedUser);
          setToken(storedToken);
        }
      } else {
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = useCallback(async ({ identifier, username, email, password }) => {
    setError(null);
    try {
      const result = await authService.login({ identifier, username, email, password });
      setUser(result.user);
      setToken(result.token);
      return result.user;
    } catch (err) {
      const msg = err.response?.data?.message || (err.response?.status === 401 || err.response?.status === 400 ? 'Invalid username or password.' : err.message);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const register = useCallback(async (userData) => {
    setError(null);
    try {
      const result = await authService.register(userData);
      setUser(result.user);
      setToken(result.token);
      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const updateProfile = useCallback(
    async (profileData) => {
      if (!user) throw new Error('No user is currently signed in');
      const updated = await authService.updateProfile(user.id, profileData);
      setUser(updated);
      return updated;
    },
    [user]
  );

  const changePassword = useCallback(
    async (currentPassword, newPassword) => {
      if (!user) throw new Error('No user is currently signed in');
      return await authService.changePassword(user.id, currentPassword, newPassword);
    },
    [user]
  );

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setToken(null);
    setError(null);
  }, []);

  const rawRole = (user?.role || '').toUpperCase();
  const isAdmin = rawRole === 'ADMIN' || rawRole === 'ROLE_ADMIN';
  const isUser = !isAdmin;

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isAdmin,
    isUser,
    role: isAdmin ? 'ADMIN' : 'USER',
    loading,
    error,
    login,
    register,
    updateProfile,
    changePassword,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
