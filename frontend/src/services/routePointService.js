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
      const fallback = await apiClient.get('/route-points', { params: { tripId } });
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
        console.warn('POST /trips/{id}/route-points failed, falling back to /route-points', err);
      }
    }

    const response = await apiClient.post('/route-points', payload);
    return response.data;
  },

  /**
   * Batch persist an array of route breadcrumb points to Spring Boot backend
   */
  createBatch: async (tripId, points) => {
    if (!points || points.length === 0) return [];
    const formattedPoints = points.map((p, idx) => ({
      id: p.id || `pt_${tripId}_${p.sequenceNumber || Date.now() + '_' + idx}`,
      tripId: tripId,
      latitude: p.latitude || p.lat,
      longitude: p.longitude || p.lng,
      accuracy: p.accuracy ? Math.round(p.accuracy) : 6,
      speed: p.speed !== undefined ? p.speed : 0,
      heading: p.heading !== undefined ? p.heading : 0,
      sequenceNumber: p.sequenceNumber || idx + 1,
      segmentIndex: p.segmentIndex !== undefined ? p.segmentIndex : 0,
      timestamp: p.timestamp || p.recordedAt || new Date().toISOString(),
      recordedAt: p.recordedAt || p.timestamp || new Date().toISOString(),
    }));

    try {
      const response = await apiClient.post(`/trips/${tripId}/route-points/batch`, formattedPoints);
      return response.data;
    } catch (err) {
      // Fallback: save individually
      const results = [];
      for (const pt of formattedPoints) {
        try {
          const res = await apiClient.post(`/trips/${tripId}/route-points`, pt);
          results.push(res.data);
        } catch {
          const res = await apiClient.post('/route-points', pt);
          results.push(res.data);
        }
      }
      return results;
    }
  },

  /**
   * Fetch all route points
   */
  getAll: async (params = {}) => {
    const response = await apiClient.get('/route-points', { params });
    return response.data || [];
  },

  /**
   * Fetch previous route points excluding the current active trip
   */
  getPreviousRoutePoints: async (excludeTripId) => {
    const params = excludeTripId ? { excludeTripId } : {};
    const response = await apiClient.get('/route-points', { params });
    return response.data || [];
  },

  /**
   * Delete a single route point
   */
  delete: async (id) => {
    const response = await apiClient.delete(`/route-points/${id}`);
    return response.data;
  },

  /**
   * Clear all route points for a given trip
   */
  deleteByTripId: async (tripId) => {
    try {
      const response = await apiClient.delete(`/route-points/trip/${tripId}`);
      return response.data;
    } catch {
      const points = await routePointService.getByTripId(tripId);
      for (const pt of points) {
        await apiClient.delete(`/route-points/${pt.id}`);
      }
      return true;
    }
  },
};

export default routePointService;
