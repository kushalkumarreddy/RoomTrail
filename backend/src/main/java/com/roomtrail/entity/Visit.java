package com.roomtrail.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "visits")
public class Visit {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "user_id")
    private Long userId = 1L;

    @Column(name = "trip_id", length = 64)
    private String tripId;

    @Column(name = "destination_id", length = 64)
    private String destinationId;

    @Column(name = "property_id", length = 64)
    private String propertyId;

    @Column(name = "property_name", length = 200)
    private String propertyName;

    @Column(length = 50)
    private String category;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(name = "arrival_time")
    private String arrivalTime;

    @Column(name = "visited_at")
    private String visitedAt;

    @Column(name = "departure_time")
    private String departureTime;

    @Column(name = "visit_lat")
    private Double visitLat;

    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "visit_lng")
    private Double visitLng;

    @Column(name = "longitude")
    private Double longitude;

    @Column(name = "visit_status", length = 50)
    private String visitStatus = "confirmed";

    @Column(length = 50)
    private String status = "confirmed";

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "is_revisit")
    private Boolean isRevisit = false;

    @Column(name = "visit_number")
    private Integer visitNumber = 1;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Visit() {}

    @PrePersist
    protected void onCreate() {
        if (id == null || id.trim().isEmpty()) {
            id = String.valueOf(System.currentTimeMillis());
        }
        if (userId == null) userId = 1L;
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (visitedAt == null && arrivalTime != null) visitedAt = arrivalTime;
        if (arrivalTime == null && visitedAt != null) arrivalTime = visitedAt;
        if (latitude == null && visitLat != null) latitude = visitLat;
        if (visitLat == null && latitude != null) visitLat = latitude;
        if (longitude == null && visitLng != null) longitude = visitLng;
        if (visitLng == null && longitude != null) visitLng = longitude;
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

    public String getTripId() { return tripId; }
    public void setTripId(String tripId) { this.tripId = tripId; }

    public String getDestinationId() { return destinationId; }
    public void setDestinationId(String destinationId) { this.destinationId = destinationId; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public String getPropertyName() { return propertyName; }
    public void setPropertyName(String propertyName) { this.propertyName = propertyName; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getArrivalTime() { return arrivalTime; }
    public void setArrivalTime(String arrivalTime) { this.arrivalTime = arrivalTime; }

    public String getVisitedAt() { return visitedAt; }
    public void setVisitedAt(String visitedAt) { this.visitedAt = visitedAt; }

    public String getDepartureTime() { return departureTime; }
    public void setDepartureTime(String departureTime) { this.departureTime = departureTime; }

    public Double getVisitLat() { return visitLat != null ? visitLat : latitude; }
    public void setVisitLat(Double visitLat) {
        this.visitLat = visitLat;
        if (this.latitude == null) this.latitude = visitLat;
    }

    public Double getLatitude() { return latitude != null ? latitude : visitLat; }
    public void setLatitude(Double latitude) {
        this.latitude = latitude;
        if (this.visitLat == null) this.visitLat = latitude;
    }

    public Double getVisitLng() { return visitLng != null ? visitLng : longitude; }
    public void setVisitLng(Double visitLng) {
        this.visitLng = visitLng;
        if (this.longitude == null) this.longitude = visitLng;
    }

    public Double getLongitude() { return longitude != null ? longitude : visitLng; }
    public void setLongitude(Double longitude) {
        this.longitude = longitude;
        if (this.visitLng == null) this.visitLng = longitude;
    }

    public String getVisitStatus() { return visitStatus; }
    public void setVisitStatus(String visitStatus) { this.visitStatus = visitStatus; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Boolean getIsRevisit() { return isRevisit; }
    public void setIsRevisit(Boolean isRevisit) { this.isRevisit = isRevisit; }

    public String getVisitId() { return id; }
    public void setVisitId(String visitId) { if (this.id == null) this.id = visitId; }

    public Integer getVisitNumber() { return visitNumber != null ? visitNumber : 1; }
    public void setVisitNumber(Integer visitNumber) { this.visitNumber = visitNumber; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
