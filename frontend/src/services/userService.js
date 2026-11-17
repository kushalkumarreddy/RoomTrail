import apiClient from './api';

/**
 * Service for managing user entities in JSON Server / Spring Boot backend
 */
export const userService = {
  /**
   * Get all users
   */
  getAll: async () => {
    const response = await apiClient.get('/users');
    return response.data || [];
  },

  /**
   * Get a single user by ID
   */
  getById: async (id) => {
    const response = await apiClient.get(`/users/${id}`);
    const user = { ...response.data };
    delete user.password;
    return user;
  },

  /**
   * Find a user by email address
   */
  getByEmail: async (email) => {
    const cleanEmail = email.trim().toLowerCase();
    const response = await apiClient.get('/users');
    const users = response.data || [];
    return users.find((u) => u.email?.toLowerCase() === cleanEmail) || null;
  },

  /**
   * Find a user by username
   */
  getByUsername: async (username) => {
    const cleanUsername = username.trim().toLowerCase();
    const response = await apiClient.get('/users');
    const users = response.data || [];
    return users.find((u) => u.username?.toLowerCase() === cleanUsername) || null;
  },

  /**
   * Create a new user record
   */
  create: async (userData) => {
    const payload = {
      ...userData,
      id: userData.id || String(Date.now()),
      createdAt: userData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const response = await apiClient.post('/users', payload);
    return response.data;
  },

  /**
   * Update user profile fields
   */
  update: async (id, updates) => {
    const payload = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    const response = await apiClient.patch(`/users/${id}`, payload);
    const updatedUser = { ...response.data };
    delete updatedUser.password;
    return updatedUser;
  },

  /**
   * Change user password
   */
  changePassword: async (id, currentPassword, newPassword) => {
    const response = await apiClient.get(`/users/${id}`);
    const user = response.data;
    if (user.password !== currentPassword) {
      throw new Error('Current password does not match.');
    }
    await apiClient.patch(`/users/${id}`, {
      password: newPassword,
      updatedAt: new Date().toISOString(),
    });
    return true;
  },

  /**
   * Delete user account
   */
  delete: async (id) => {
    const response = await apiClient.delete(`/users/${id}`);
    return response.data;
  },

  /**
   * Phase 8: Get authenticated user's tracking safety preferences
   */
  getTrackingPreferences: async () => {
    const response = await apiClient.get('/user/tracking-preferences');
    return response.data;
  },

  /**
   * Phase 8: Update authenticated user's tracking safety preferences
   */
  updateTrackingPreferences: async (preferences) => {
    const response = await apiClient.put('/user/tracking-preferences', preferences);
    return response.data;
  },
};

export default userService;
