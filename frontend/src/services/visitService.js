import apiClient from './api';

/**
 * Service for managing Visits in JSON Server / Spring Boot backend
 * Strictly conforms to Phase 3 Visit Fields:
 * - id, userId, tripId, destinationId, arrivalTime, departureTime, visitCoordinates, visitStatus, notes
 */
export const visitService = {
  getAll: async (params = {}) => {
    const response = await apiClient.get('/visits', { params });
    const visits = response.data || [];
    return visits.map(visitService.normalize);
  },

  getById: async (id) => {
    const response = await apiClient.get(`/visits/${id}`);
    return visitService.normalize(response.data);
  },

  recordVisit: async (visitData) => {
    const now = new Date().toISOString();
    const payload = {
      id: visitData.id || String(Date.now()),
      userId: visitData.userId || '1',
      tripId: visitData.tripId || null,
      destinationId: visitData.destinationId || visitData.propertyId || String(Date.now()),
      propertyId: visitData.propertyId || visitData.destinationId || String(Date.now()),
      propertyName: visitData.propertyName || 'Visited Location',
      category: visitData.category || 'Rental',
      address: visitData.address || '',
      arrivalTime: visitData.arrivalTime || visitData.visitedAt || now,
      visitedAt: visitData.visitedAt || visitData.arrivalTime || now,
      departureTime: visitData.departureTime || null,
      visitLat: visitData.latitude ?? visitData.visitCoordinates?.lat ?? null,
      visitLng: visitData.longitude ?? visitData.visitCoordinates?.lng ?? null,
      visitCoordinates: visitData.visitCoordinates || (visitData.latitude && visitData.longitude ? { lat: visitData.latitude, lng: visitData.longitude } : { lat: 17.4938, lng: 78.3968 }),
      visitStatus: visitData.visitStatus || visitData.status || 'confirmed', // 'confirmed', 'skipped', 'revisited'
      status: visitData.status || visitData.visitStatus || 'confirmed',
      notes: visitData.notes || '',
      isRevisit: Boolean(visitData.isRevisit),
      visitNumber: visitData.visitNumber || 1,
    };

    const response = await apiClient.post('/visits', payload);
    return visitService.normalize(response.data);
  },

  update: async (id, data) => {
    const response = await apiClient.patch(`/visits/${id}`, data);
    return visitService.normalize(response.data);
  },

  deleteVisit: async (id) => {
    const response = await apiClient.delete(`/visits/${id}`);
    return response.data;
  },

  /**
   * Normalizer to guarantee all required Phase 3 visit fields are present
   */
  normalize: (visit) => {
    if (!visit) return visit;
    const lat = visit.visitLat ?? visit.latitude ?? visit.visitCoordinates?.lat ?? 17.4938;
    const lng = visit.visitLng ?? visit.longitude ?? visit.visitCoordinates?.lng ?? 78.3968;
    const vNum = visit.visitNumber || (visit.isRevisit ? 2 : 1);
    return {
      ...visit,
      id: String(visit.id),
      userId: String(visit.userId || '1'),
      destinationId: visit.destinationId || visit.propertyId || '',
      propertyId: visit.propertyId || visit.destinationId || '',
      arrivalTime: visit.arrivalTime || visit.visitedAt || '',
      visitedAt: visit.visitedAt || visit.arrivalTime || '',
      departureTime: visit.departureTime || null,
      latitude: lat,
      longitude: lng,
      visitCoordinates: { lat, lng },
      visitNumber: vNum,
      visitSequenceNumber: vNum,
      visitStatus: visit.visitStatus || visit.status || 'confirmed',
      status: visit.status || visit.visitStatus || 'confirmed',
      notes: visit.notes || '',
    };
  },
};

export default visitService;
