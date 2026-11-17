package com.roomtrail.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "route_points")
public class RoutePoint {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "trip_id", nullable = false, length = 64)
    private String tripId;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    private Integer accuracy;
    private Double speed;
    private Double heading;

    @Column(length = 64)
    private String timestamp;

    @Column(name = "recorded_at", length = 64)
    private String recordedAt;

    @Column(name = "sequence_number")
    private Integer sequenceNumber = 1;

    @Column(name = "segment_index")
    private Integer segmentIndex = 0;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public RoutePoint() {}

    @PrePersist
    protected void onCreate() {
        if (id == null || id.trim().isEmpty()) {
            id = String.valueOf(System.currentTimeMillis());
        }
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (timestamp == null) timestamp = LocalDateTime.now().toString();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTripId() { return tripId; }
    public void setTripId(String tripId) { this.tripId = tripId; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public Integer getAccuracy() { return accuracy; }
    public void setAccuracy(Integer accuracy) { this.accuracy = accuracy; }

    public Double getSpeed() { return speed; }
    public void setSpeed(Double speed) { this.speed = speed; }

    public Double getHeading() { return heading; }
    public void setHeading(Double heading) { this.heading = heading; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

    public String getRoutePointId() { return id; }
    public void setRoutePointId(String routePointId) { if (this.id == null) this.id = routePointId; }

    public String getRecordedAt() { return recordedAt != null ? recordedAt : timestamp; }
    public void setRecordedAt(String recordedAt) {
        this.recordedAt = recordedAt;
        if (this.timestamp == null) this.timestamp = recordedAt;
    }

    public Integer getSequenceNumber() { return sequenceNumber != null ? sequenceNumber : 1; }
    public void setSequenceNumber(Integer sequenceNumber) { this.sequenceNumber = sequenceNumber; }

    public Integer getSegmentIndex() { return segmentIndex != null ? segmentIndex : 0; }
    public void setSegmentIndex(Integer segmentIndex) { this.segmentIndex = segmentIndex; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
