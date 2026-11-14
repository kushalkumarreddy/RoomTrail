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

  const login = useCallback(async ({ identifier, password }) => {
    setError(null);
    try {
      const result = await authService.login({ identifier, password });
      setUser(result.user);
      setToken(result.token);
      return result.user;
    } catch (err) {
      setError(err.message);
      throw err;
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

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
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
