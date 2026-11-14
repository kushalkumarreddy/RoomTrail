import apiClient from './api';

/**
 * Service for managing GPS route breadcrumb points in JSON Server / Spring Boot backend
 */
export const routePointService = {
  /**
   * Fetch all route points
   */
  getAll: async (params = {}) => {
    const response = await apiClient.get('/routePoints', { params });
    return response.data || [];
  },

  /**
   * Fetch route points for a specific trip in chronological order
   */
  getByTripId: async (tripId) => {
    const response = await apiClient.get('/routePoints', {
      params: { tripId },
    });
    const points = response.data || [];
    return points.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  },

  /**
   * Add a GPS route point
   */
  create: async (point) => {
    const now = new Date().toISOString();
    const payload = {
      ...point,
      id: point.id || String(Date.now()),
      timestamp: point.timestamp || point.recordedAt || now,
      recordedAt: point.recordedAt || point.timestamp || now,
      sequenceNumber: point.sequenceNumber || 1,
    };
    const response = await apiClient.post('/routePoints', payload);
    return response.data;
  },

  /**
   * Delete a single route point
   */
  delete: async (id) => {
    const response = await apiClient.delete(`/routePoints/${id}`);
    return response.data;
  },

  /**
   * Clear all route points for a given trip
   */
  deleteByTripId: async (tripId) => {
    const points = await routePointService.getByTripId(tripId);
    for (const pt of points) {
      await apiClient.delete(`/routePoints/${pt.id}`);
    }
    return true;
  },
};

export default routePointService;
