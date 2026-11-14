package com.roomtrail.dto;

import java.util.List;
import java.util.Map;

public class AggregatedMetricsDto {

    private long totalDestinations;
    private long totalTrips;
    private long activeTripsCount;
    private long completedTripsCount;
    private long totalVisits;
    private long totalDistanceMeters;
    private List<Map<String, Object>> recentDestinations;
    private List<Map<String, Object>> recentTrips;

    public AggregatedMetricsDto() {}

    public long getTotalDestinations() { return totalDestinations; }
    public void setTotalDestinations(long totalDestinations) { this.totalDestinations = totalDestinations; }

    public long getTotalTrips() { return totalTrips; }
    public void setTotalTrips(long totalTrips) { this.totalTrips = totalTrips; }

    public long getActiveTripsCount() { return activeTripsCount; }
    public void setActiveTripsCount(long activeTripsCount) { this.activeTripsCount = activeTripsCount; }

    public long getCompletedTripsCount() { return completedTripsCount; }
    public void setCompletedTripsCount(long completedTripsCount) { this.completedTripsCount = completedTripsCount; }

    public long getTotalVisits() { return totalVisits; }
    public void setTotalVisits(long totalVisits) { this.totalVisits = totalVisits; }

    public long getTotalDistanceMeters() { return totalDistanceMeters; }
    public void setTotalDistanceMeters(long totalDistanceMeters) { this.totalDistanceMeters = totalDistanceMeters; }

    public List<Map<String, Object>> getRecentDestinations() { return recentDestinations; }
    public void setRecentDestinations(List<Map<String, Object>> recentDestinations) { this.recentDestinations = recentDestinations; }

    public List<Map<String, Object>> getRecentTrips() { return recentTrips; }
    public void setRecentTrips(List<Map<String, Object>> recentTrips) { this.recentTrips = recentTrips; }
}
