import apiClient from './api';
import { storage } from '../utils/storage';

export const authService = {
  /**
   * Login user with email/username and password via Spring Boot Security
   */
  login: async ({ identifier, username, email, password }) => {
    try {
      const userIdentifier = (username || identifier || email || '').trim();
      const response = await apiClient.post('/auth/login', {
        username: userIdentifier,
        email: userIdentifier,
        password: password,
      });

      const { token, user } = response.data;

      // Save credentials in storage
      storage.setUser(user);
      storage.setToken(token);

      return { user, token };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Register a new user via Spring Boot Security
   */
  register: async (userData) => {
    try {
      const response = await apiClient.post('/auth/register', {
        username: userData.username.trim().toLowerCase(),
        email: userData.email.trim().toLowerCase(),
        password: userData.password,
        fullName: userData.fullName?.trim() || userData.username,
        phone: userData.phone?.trim() || '',
        city: userData.city || 'Hyderabad, India',
        travelMode: userData.travelMode || 'car',
      });

      const { token, user } = response.data;

      storage.setUser(user);
      storage.setToken(token);

      return { user, token };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get fresh user profile by ID / current authenticated user
   */
  getUserById: async (id) => {
    try {
      const response = await apiClient.get('/users/profile');
      return response.data;
    } catch {
      return storage.getUser();
    }
  },

  /**
   * Update user profile via Spring Boot
   */
  updateProfile: async (id, profileData) => {
    const response = await apiClient.put('/users/profile', profileData);
    const updatedUser = response.data;
    storage.setUser(updatedUser);
    return updatedUser;
  },

  /**
   * Logout user
   */
  logout: () => {
    storage.clearAuth();
  },

  /**
   * Health check against Spring Boot Backend
   */
  checkHealth: async () => {
    try {
      await apiClient.get('/auth/health');
      return true;
    } catch {
      return false;
    }
  },
};

export default authService;
