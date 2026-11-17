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

    @Column(name = "start_latitude")
    private Double startLatitude;

    @Column(name = "start_lng")
    private Double startLng = 77.5946;

    @Column(name = "start_longitude")
    private Double startLongitude;

    @Column(name = "end_location", length = 200)
    private String endLocation = "Indiranagar Central";

    @Column(name = "end_lat")
    private Double endLat = 12.9784;

    @Column(name = "end_latitude")
    private Double endLatitude;

    @Column(name = "end_lng")
    private Double endLng = 77.6408;

    @Column(name = "end_longitude")
    private Double endLongitude;

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

        if (startLatitude == null && startLat != null) startLatitude = startLat;
        if (startLat == null && startLatitude != null) startLat = startLatitude;
        if (startLongitude == null && startLng != null) startLongitude = startLng;
        if (startLng == null && startLongitude != null) startLng = startLongitude;
        if (endLatitude == null && endLat != null) endLatitude = endLat;
        if (endLat == null && endLatitude != null) endLat = endLatitude;
        if (endLongitude == null && endLng != null) endLongitude = endLng;
        if (endLng == null && endLongitude != null) endLng = endLongitude;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
        if (startLatitude == null && startLat != null) startLatitude = startLat;
        if (startLat == null && startLatitude != null) startLat = startLatitude;
        if (startLongitude == null && startLng != null) startLongitude = startLng;
        if (startLng == null && startLongitude != null) startLng = startLongitude;
        if (endLatitude == null && endLat != null) endLatitude = endLat;
        if (endLat == null && endLatitude != null) endLat = endLatitude;
        if (endLongitude == null && endLng != null) endLongitude = endLng;
        if (endLng == null && endLongitude != null) endLng = endLongitude;
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

    public Double getStartLat() { return startLat != null ? startLat : startLatitude; }
    public void setStartLat(Double startLat) {
        this.startLat = startLat;
        if (this.startLatitude == null) this.startLatitude = startLat;
    }

    public Double getStartLatitude() { return startLatitude != null ? startLatitude : startLat; }
    public void setStartLatitude(Double startLatitude) {
        this.startLatitude = startLatitude;
        if (this.startLat == null) this.startLat = startLatitude;
    }

    public Double getStartLng() { return startLng != null ? startLng : startLongitude; }
    public void setStartLng(Double startLng) {
        this.startLng = startLng;
        if (this.startLongitude == null) this.startLongitude = startLng;
    }

    public Double getStartLongitude() { return startLongitude != null ? startLongitude : startLng; }
    public void setStartLongitude(Double startLongitude) {
        this.startLongitude = startLongitude;
        if (this.startLng == null) this.startLng = startLongitude;
    }

    public String getEndLocation() { return endLocation; }
    public void setEndLocation(String endLocation) { this.endLocation = endLocation; }

    public Double getEndLat() { return endLat != null ? endLat : endLatitude; }
    public void setEndLat(Double endLat) {
        this.endLat = endLat;
        if (this.endLatitude == null) this.endLatitude = endLat;
    }

    public Double getEndLatitude() { return endLatitude != null ? endLatitude : endLat; }
    public void setEndLatitude(Double endLatitude) {
        this.endLatitude = endLatitude;
        if (this.endLat == null) this.endLat = endLatitude;
    }

    public Double getEndLng() { return endLng != null ? endLng : endLongitude; }
    public void setEndLng(Double endLng) {
        this.endLng = endLng;
        if (this.endLongitude == null) this.endLongitude = endLng;
    }

    public Double getEndLongitude() { return endLongitude != null ? endLongitude : endLng; }
    public void setEndLongitude(Double endLongitude) {
        this.endLongitude = endLongitude;
        if (this.endLng == null) this.endLng = endLongitude;
    }

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
