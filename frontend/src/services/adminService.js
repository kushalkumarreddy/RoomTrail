import apiClient from './api';

export const adminService = {
  /**
   * Fetch aggregate platform metrics for Admin Dashboard (Zero PII)
   */
  getMetrics: async () => {
    const response = await apiClient.get('/admin/metrics');
    return response.data;
  },

  /**
   * Fetch registered accounts list with masked references (Zero PII)
   */
  getUsers: async () => {
    const response = await apiClient.get('/admin/users');
    return response.data || [];
  },

  /**
   * Fetch platform overview aggregates (room categories, trip statuses - Zero PII)
   */
  getOverview: async () => {
    const response = await apiClient.get('/admin/overview');
    return response.data;
  },

  /**
   * Update account status (ACTIVE <-> DEACTIVATED)
   */
  updateUserStatus: async (userId, status) => {
    const response = await apiClient.put(`/admin/users/${userId}/status`, { status });
    return response.data;
  },

  /**
   * Permanently delete user account and associated records (Irreversible cascade delete)
   */
  deleteUser: async (userId) => {
    const response = await apiClient.delete(`/admin/users/${userId}`);
    return response.data;
  },

  /**
   * Fetch administrative audit logs (Zero PII)
   */
  getAuditLogs: async () => {
    const response = await apiClient.get('/admin/audit-logs');
    return response.data || [];
  },
};

export default adminService;
