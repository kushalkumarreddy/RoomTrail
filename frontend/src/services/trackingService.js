import apiClient from './api';

export const trackingService = {
  getRoutePoints: async (tripId) => {
    const params = tripId ? { tripId } : {};
    const response = await apiClient.get('/routePoints', { params });
    return response.data;
  },

  addRoutePoint: async (point) => {
    const payload = {
      ...point,
      timestamp: point.timestamp || new Date().toISOString(),
    };
    const response = await apiClient.post('/routePoints', payload);
    return response.data;
  },

  deleteRoutePointsForTrip: async (tripId) => {
    // In JSON server, multiple deletes can be called or cleaned up
    const points = await trackingService.getRoutePoints(tripId);
    for (const pt of points) {
      await apiClient.delete(`/routePoints/${pt.id}`);
    }
  },

  getTrackingPreferences: async () => {
    const response = await apiClient.get('/user/tracking-preferences');
    return response.data;
  },

  updateTrackingPreferences: async (preferences) => {
    const response = await apiClient.put('/user/tracking-preferences', preferences);
    return response.data;
  },
};
