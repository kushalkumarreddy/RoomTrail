import apiClient from './api';

/**
 * Service for managing Trips in JSON Server / Spring Boot backend
 * Strictly conforms to Phase 3 Trip Fields:
 * - id, userId, tripName, startLocation, startCoordinates, endLocation, endCoordinates,
 *   startTime, endTime, status, totalDistance, totalDuration
 */
export const tripService = {
  getAll: async (params = {}) => {
    const response = await apiClient.get('/trips', { params });
    const trips = response.data || [];
    return trips.map(tripService.normalize);
  },

  getById: async (id) => {
    const response = await apiClient.get(`/trips/${id}`);
    return tripService.normalize(response.data);
  },

  getHistoryRoutes: async (params = {}) => {
    const response = await apiClient.get('/trips/history/routes', { params });
    return response.data || [];
  },

  create: async (data) => {
    const now = new Date().toISOString();
    const payload = {
      id: data.id || String(Date.now()),
      userId: data.userId || '1',
      tripName: data.tripName || data.title || 'Untitled Trip',
      title: data.title || data.tripName || 'Untitled Trip',
      description: data.description || '',
      startLocation: data.startLocation || 'Bengaluru Base',
      startCoordinates: data.startCoordinates || { lat: 12.9716, lng: 77.5946 },
      endLocation: data.endLocation || 'Indiranagar Central',
      endCoordinates: data.endCoordinates || { lat: 12.9784, lng: 77.6408 },
      startTime: data.startTime || data.scheduledDate || now,
      scheduledDate: data.scheduledDate || data.startTime || now.split('T')[0],
      endTime: data.endTime || null,
      status: data.status || 'planned', // 'planned', 'active', 'completed', 'cancelled'
      totalDistance: data.totalDistance || '0 km',
      totalDuration: data.totalDuration || '0 mins',
      travelMode: data.travelMode || 'car',
      destinations: Array.isArray(data.destinations) ? data.destinations : [],
      createdAt: now,
      updatedAt: now,
    };

    const response = await apiClient.post('/trips', payload);
    return tripService.normalize(response.data);
  },

  update: async (id, data) => {
    const now = new Date().toISOString();
    const payload = {
      ...data,
      ...(data.tripName && { title: data.tripName }),
      ...(data.title && { tripName: data.title }),
      updatedAt: now,
    };
    const response = await apiClient.patch(`/trips/${id}`, payload);
    return tripService.normalize(response.data);
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/trips/${id}`);
    return response.data;
  },

  /**
   * Normalizer to guarantee all required Phase 3 trip fields are present
   */
  normalize: (trip) => {
    if (!trip) return trip;
    return {
      ...trip,
      id: String(trip.id),
      userId: String(trip.userId || '1'),
      tripName: trip.tripName || trip.title || 'Untitled Trip',
      title: trip.title || trip.tripName || 'Untitled Trip',
      startLocation: trip.startLocation || 'Starting Point',
      startCoordinates: trip.startCoordinates || { lat: 12.9716, lng: 77.5946 },
      endLocation: trip.endLocation || 'Final Destination',
      endCoordinates: trip.endCoordinates || { lat: 12.9784, lng: 77.6408 },
      startTime: trip.startTime || trip.scheduledDate || trip.createdAt || '',
      endTime: trip.endTime || null,
      totalDistance: trip.totalDistance || (trip.totalDistanceMeters ? `${(trip.totalDistanceMeters / 1000).toFixed(1)} km` : '0 km'),
      totalDuration: trip.totalDuration || '0 mins',
      status: trip.status || 'planned',
      travelMode: trip.travelMode || 'car',
      destinations: Array.isArray(trip.destinations) ? trip.destinations : [],
    };
  },
};

export default tripService;
