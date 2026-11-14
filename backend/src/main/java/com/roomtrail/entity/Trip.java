package com.roomtrail.entity;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "trips")
public class Trip {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "user_id")
    private Long userId = 1L;

    @Column(name = "trip_name", nullable = false, length = 200)
    private String tripName;

    @Column(length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "start_location", length = 200)
    private String startLocation = "Home Base";

    @Column(name = "start_lat")
    private Double startLat = 12.9716;

    @Column(name = "start_lng")
    private Double startLng = 77.5946;

    @Column(name = "end_location", length = 200)
    private String endLocation = "Indiranagar Central";

    @Column(name = "end_lat")
    private Double endLat = 12.9784;

    @Column(name = "end_lng")
    private Double endLng = 77.6408;

    @Column(name = "start_time")
    private String startTime;

    @Column(name = "scheduled_date")
    private String scheduledDate;

    @Column(name = "end_time")
    private String endTime;

    @Column(length = 50)
    private String status = "planned"; // 'planned', 'active', 'completed', 'cancelled'

    @Column(name = "total_distance", length = 50)
    private String totalDistance = "0 km";

    @Column(name = "total_duration", length = 50)
    private String totalDuration = "0 mins";

    @Column(name = "travel_mode", length = 50)
    private String travelMode = "car";

    @Column(name = "destinations_json", columnDefinition = "LONGTEXT")
    private String destinationsJson;

    @Transient
    private List<Map<String, Object>> destinations = new ArrayList<>();

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    public Trip() {}

    @PrePersist
    protected void onCreate() {
        if (id == null || id.trim().isEmpty()) {
            id = String.valueOf(System.currentTimeMillis());
        }
        if (userId == null) userId = 1L;
        if (title == null || title.trim().isEmpty()) {
            title = tripName;
        }
        if (tripName == null || tripName.trim().isEmpty()) {
            tripName = title;
        }
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

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

    public String getTripName() { return tripName; }
    public void setTripName(String tripName) { this.tripName = tripName; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getStartLocation() { return startLocation; }
    public void setStartLocation(String startLocation) { this.startLocation = startLocation; }

    public Double getStartLat() { return startLat; }
    public void setStartLat(Double startLat) { this.startLat = startLat; }

    public Double getStartLng() { return startLng; }
    public void setStartLng(Double startLng) { this.startLng = startLng; }

    public String getEndLocation() { return endLocation; }
    public void setEndLocation(String endLocation) { this.endLocation = endLocation; }

    public Double getEndLat() { return endLat; }
    public void setEndLat(Double endLat) { this.endLat = endLat; }

    public Double getEndLng() { return endLng; }
    public void setEndLng(Double endLng) { this.endLng = endLng; }

    public String getStartTime() { return startTime; }
    public void setStartTime(String startTime) { this.startTime = startTime; }

    public String getScheduledDate() { return scheduledDate; }
    public void setScheduledDate(String scheduledDate) { this.scheduledDate = scheduledDate; }

    public String getEndTime() { return endTime; }
    public void setEndTime(String endTime) { this.endTime = endTime; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getTotalDistance() { return totalDistance; }
    public void setTotalDistance(String totalDistance) { this.totalDistance = totalDistance; }

    public String getTotalDuration() { return totalDuration; }
    public void setTotalDuration(String totalDuration) { this.totalDuration = totalDuration; }

    public String getTravelMode() { return travelMode; }
    public void setTravelMode(String travelMode) { this.travelMode = travelMode; }

    public String getDestinationsJson() { return destinationsJson; }
    public void setDestinationsJson(String destinationsJson) { this.destinationsJson = destinationsJson; }

    public List<Map<String, Object>> getDestinations() {
        if ((destinations == null || destinations.isEmpty()) && destinationsJson != null && !destinationsJson.trim().isEmpty()) {
            try {
                ObjectMapper mapper = new ObjectMapper();
                return mapper.readValue(destinationsJson, new TypeReference<List<Map<String, Object>>>() {});
            } catch (Exception e) {
                return Collections.emptyList();
            }
        }
        return destinations != null ? destinations : Collections.emptyList();
    }

    public void setDestinations(List<Map<String, Object>> destinations) {
        this.destinations = destinations;
        if (destinations != null) {
            try {
                ObjectMapper mapper = new ObjectMapper();
                this.destinationsJson = mapper.writeValueAsString(destinations);
            } catch (Exception e) {
                this.destinationsJson = destinations.toString();
            }
        }
    }

    public String getTripId() { return id; }
    public void setTripId(String tripId) { if (this.id == null) this.id = tripId; }

    public String getName() { return tripName != null ? tripName : title; }
    public void setName(String name) { this.tripName = name; this.title = name; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
