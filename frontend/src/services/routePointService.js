import apiClient from './api';

/**
 * Service for managing GPS route breadcrumb points in Spring Boot backend
 */
export const routePointService = {
  /**
   * Fetch route points for a specific trip in chronological order
   */
  getByTripId: async (tripId) => {
    try {
      const response = await apiClient.get(`/trips/${tripId}/route-points`);
      const points = response.data || [];
      return points.sort((a, b) => {
        const seqA = a.sequenceNumber != null ? a.sequenceNumber : 0;
        const seqB = b.sequenceNumber != null ? b.sequenceNumber : 0;
        if (seqA !== seqB) return seqA - seqB;
        const timeA = new Date(a.recordedAt || a.timestamp || 0).getTime();
        const timeB = new Date(b.recordedAt || b.timestamp || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return String(a.id || '').localeCompare(String(b.id || ''));
      });
    } catch {
      // Fallback for query param style if needed
      const fallback = await apiClient.get('/routePoints', { params: { tripId } });
      const points = fallback.data || [];
      return points.sort((a, b) => {
        const seqA = a.sequenceNumber != null ? a.sequenceNumber : 0;
        const seqB = b.sequenceNumber != null ? b.sequenceNumber : 0;
        if (seqA !== seqB) return seqA - seqB;
        const timeA = new Date(a.recordedAt || a.timestamp || 0).getTime();
        const timeB = new Date(b.recordedAt || b.timestamp || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return String(a.id || '').localeCompare(String(b.id || ''));
      });
    }
  },

  /**
   * Add a GPS route point through Spring Boot REST API
   */
  create: async (point) => {
    const now = new Date().toISOString();
    const payload = {
      ...point,
      id: point.id || String(Date.now()),
      tripId: point.tripId,
      latitude: point.latitude || point.lat,
      longitude: point.longitude || point.lng,
      accuracy: point.accuracy ? Math.round(point.accuracy) : 6,
      speed: point.speed !== undefined ? point.speed : 0,
      heading: point.heading !== undefined ? point.heading : 0,
      timestamp: point.timestamp || point.recordedAt || now,
      recordedAt: point.recordedAt || point.timestamp || now,
      sequenceNumber: point.sequenceNumber || 1,
    };

    if (payload.tripId) {
      try {
        const response = await apiClient.post(`/trips/${payload.tripId}/route-points`, payload);
        return response.data;
      } catch (err) {
        console.warn('POST /trips/{id}/route-points failed, falling back to /routePoints', err);
      }
    }

    const response = await apiClient.post('/routePoints', payload);
    return response.data;
  },

  /**
   * Fetch all route points
   */
  getAll: async (params = {}) => {
    const response = await apiClient.get('/routePoints', { params });
    return response.data || [];
  },

  /**
   * Fetch previous route points excluding the current active trip
   */
  getPreviousRoutePoints: async (excludeTripId) => {
    const params = excludeTripId ? { excludeTripId } : {};
    const response = await apiClient.get('/routePoints', { params });
    return response.data || [];
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
    try {
      const response = await apiClient.delete(`/routePoints/trip/${tripId}`);
      return response.data;
    } catch {
      const points = await routePointService.getByTripId(tripId);
      for (const pt of points) {
        await apiClient.delete(`/routePoints/${pt.id}`);
      }
      return true;
    }
  },
};

export default routePointService;
