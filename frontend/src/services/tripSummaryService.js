import apiClient from './api';

/**
 * Service for managing finalized trip summaries and route analytics in JSON Server / Spring Boot backend
 */
export const tripSummaryService = {
  /**
   * Fetch all trip summaries
   */
  getAll: async (params = {}) => {
    const response = await apiClient.get('/tripSummaries', { params });
    return response.data || [];
  },

  /**
   * Fetch a summary by trip ID
   */
  getByTripId: async (tripId) => {
    const response = await apiClient.get('/tripSummaries', {
      params: { tripId },
    });
    const summaries = response.data || [];
    return summaries[0] || null;
  },

  /**
   * Create a trip summary record
   */
  create: async (summary) => {
    const payload = {
      ...summary,
      id: summary.id || String(Date.now()),
      createdAt: summary.createdAt || new Date().toISOString(),
    };
    const response = await apiClient.post('/tripSummaries', payload);
    return response.data;
  },

  /**
   * Update an existing summary
   */
  update: async (id, data) => {
    const response = await apiClient.patch(`/tripSummaries/${id}`, data);
    return response.data;
  },

  /**
   * Delete a summary
   */
  delete: async (id) => {
    const response = await apiClient.delete(`/tripSummaries/${id}`);
    return response.data;
  },

  /**
   * Compute aggregated metrics from live backend data
   */
  getAggregatedMetrics: async (userId) => {
    try {
      const [destinationsRes, tripsRes, visitsRes, summariesRes] = await Promise.all([
        apiClient.get('/properties'),
        apiClient.get('/trips'),
        apiClient.get('/visits'),
        apiClient.get('/tripSummaries'),
      ]);

      const destinations = destinationsRes.data || [];
      const trips = tripsRes.data || [];
      const visits = visitsRes.data || [];
      const summaries = summariesRes.data || [];

      const userDestinations = userId
        ? destinations.filter((d) => !d.userId || d.userId === userId)
        : destinations;
      const userTrips = userId
        ? trips.filter((t) => !t.userId || t.userId === userId)
        : trips;
      const userVisits = userId
        ? visits.filter((v) => !v.userId || v.userId === userId)
        : visits;

      const activeTrips = userTrips.filter((t) => t.status === 'active');
      const completedTrips = userTrips.filter((t) => t.status === 'completed');
      const totalDistanceMeters = summaries.reduce(
        (acc, curr) => acc + (curr.totalDistanceMeters || 0),
        0
      );

      return {
        totalDestinations: userDestinations.length,
        totalTrips: userTrips.length,
        activeTripsCount: activeTrips.length,
        completedTripsCount: completedTrips.length,
        totalVisits: userVisits.length,
        totalDistanceMeters,
        recentDestinations: userDestinations.slice(-5).reverse(),
        recentTrips: userTrips.slice(-5).reverse(),
      };
    } catch (err) {
      console.error('Error fetching aggregated metrics', err);
      return {
        totalDestinations: 0,
        totalTrips: 0,
        activeTripsCount: 0,
        completedTripsCount: 0,
        totalVisits: 0,
        totalDistanceMeters: 0,
        recentDestinations: [],
        recentTrips: [],
      };
    }
  },
};

export default tripSummaryService;
