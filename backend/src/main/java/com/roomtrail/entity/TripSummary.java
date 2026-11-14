package com.roomtrail.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "trip_summaries")
public class TripSummary {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "trip_id", nullable = false, length = 64)
    private String tripId;

    @Column(name = "user_id")
    private Long userId = 1L;

    @Column(name = "trip_title", length = 200)
    private String tripTitle;

    @Column(name = "total_distance_meters")
    private Integer totalDistanceMeters = 0;

    @Column(name = "total_distance_formatted", length = 50)
    private String totalDistanceFormatted = "0 km";

    @Column(name = "duration_seconds")
    private Integer durationSeconds = 0;

    @Column(name = "total_duration_formatted", length = 50)
    private String totalDurationFormatted = "0 mins";

    @Column(name = "max_speed_kmh")
    private Integer maxSpeedKmh = 0;

    @Column(name = "average_speed_kmh")
    private Integer averageSpeedKmh = 0;

    @Column(name = "route_points_count")
    private Integer routePointsCount = 0;

    @Column(name = "visited_destinations_count")
    private Integer visitedDestinationsCount = 0;

    @Column(name = "completed_at")
    private String completedAt;

    @Column(name = "created_at")
    private String createdAt;

    public TripSummary() {}

    @PrePersist
    protected void onCreate() {
        if (id == null || id.trim().isEmpty()) {
            id = String.valueOf(System.currentTimeMillis());
        }
        if (userId == null) userId = 1L;
        if (createdAt == null) createdAt = LocalDateTime.now().toString();
        if (completedAt == null) completedAt = LocalDateTime.now().toString();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTripId() { return tripId; }
    public void setTripId(String tripId) { this.tripId = tripId; }

    public String getUserId() {
        return userId != null ? String.valueOf(userId) : "1";
    }

    public void setUserId(Object userId) {
        if (userId instanceof Number) {
            this.userId = ((Number) userId).longValue();
        } else if (userId instanceof String && !((String) userId).trim().isEmpty()) {
            try {
                this.userId = Long.parseLong(((String) userId).trim());
            } catch (NumberFormatException e) {
                this.userId = 1L;
            }
        } else {
            this.userId = 1L;
        }
    }

    public String getTripTitle() { return tripTitle; }
    public void setTripTitle(String tripTitle) { this.tripTitle = tripTitle; }

    public Integer getTotalDistanceMeters() { return totalDistanceMeters; }
    public void setTotalDistanceMeters(Integer totalDistanceMeters) { this.totalDistanceMeters = totalDistanceMeters; }

    public String getTotalDistanceFormatted() { return totalDistanceFormatted; }
    public void setTotalDistanceFormatted(String totalDistanceFormatted) { this.totalDistanceFormatted = totalDistanceFormatted; }

    public Integer getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(Integer durationSeconds) { this.durationSeconds = durationSeconds; }

    public String getTotalDurationFormatted() { return totalDurationFormatted; }
    public void setTotalDurationFormatted(String totalDurationFormatted) { this.totalDurationFormatted = totalDurationFormatted; }

    public Integer getMaxSpeedKmh() { return maxSpeedKmh; }
    public void setMaxSpeedKmh(Integer maxSpeedKmh) { this.maxSpeedKmh = maxSpeedKmh; }

    public Integer getAverageSpeedKmh() { return averageSpeedKmh; }
    public void setAverageSpeedKmh(Integer averageSpeedKmh) { this.averageSpeedKmh = averageSpeedKmh; }

    public Integer getRoutePointsCount() { return routePointsCount; }
    public void setRoutePointsCount(Integer routePointsCount) { this.routePointsCount = routePointsCount; }

    public Integer getVisitedDestinationsCount() { return visitedDestinationsCount; }
    public void setVisitedDestinationsCount(Integer visitedDestinationsCount) { this.visitedDestinationsCount = visitedDestinationsCount; }

    public String getCompletedAt() { return completedAt; }
    public void setCompletedAt(String completedAt) { this.completedAt = completedAt; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
