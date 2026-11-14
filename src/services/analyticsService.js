import apiClient from './api';

export const analyticsService = {
  getOverviewMetrics: async (userId) => {
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

      // Filter by user if userId provided
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

      // Calculate total distance recorded across trip summaries
      const totalDistanceMeters = summaries.reduce((acc, curr) => acc + (curr.totalDistanceMeters || 0), 0);

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
    } catch (error) {
      console.error('Failed to compute analytics metrics', error);
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
