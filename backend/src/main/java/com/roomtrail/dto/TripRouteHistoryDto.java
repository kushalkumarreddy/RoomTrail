package com.roomtrail.dto;

import com.roomtrail.entity.RoutePoint;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class TripRouteHistoryDto {

    private String tripId;
    private String tripName;
    private String title;
    private String travelDate;
    private String startTime;
    private String endTime;
    private String startLocation;
    private String endLocation;
    private Double startLat;
    private Double startLng;
    private Double endLat;
    private Double endLng;
    private String totalDistance;
    private String totalDuration;
    private String travelMode;
    private String status;
    private Integer routePointsCount;
    private List<RoutePoint> routePoints = new ArrayList<>();
    private List<Map<String, Object>> destinations = new ArrayList<>();
    private Integer savedLocationsCount = 0;

    public TripRouteHistoryDto() {}

    // Getters and Setters
    public String getTripId() {
        return tripId;
    }

    public void setTripId(String tripId) {
        this.tripId = tripId;
    }

    public String getTripName() {
        return tripName;
    }

    public void setTripName(String tripName) {
        this.tripName = tripName;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getTravelDate() {
        return travelDate;
    }

    public void setTravelDate(String travelDate) {
        this.travelDate = travelDate;
    }

    public String getStartTime() {
        return startTime;
    }

    public void setStartTime(String startTime) {
        this.startTime = startTime;
    }

    public String getEndTime() {
        return endTime;
    }

    public void setEndTime(String endTime) {
        this.endTime = endTime;
    }

    public String getStartLocation() {
        return startLocation;
    }

    public void setStartLocation(String startLocation) {
        this.startLocation = startLocation;
    }

    public String getEndLocation() {
        return endLocation;
    }

    public void setEndLocation(String endLocation) {
        this.endLocation = endLocation;
    }

    public Double getStartLat() {
        return startLat;
    }

    public void setStartLat(Double startLat) {
        this.startLat = startLat;
    }

    public Double getStartLng() {
        return startLng;
    }

    public void setStartLng(Double startLng) {
        this.startLng = startLng;
    }

    public Double getEndLat() {
        return endLat;
    }

    public void setEndLat(Double endLat) {
        this.endLat = endLat;
    }

    public Double getEndLng() {
        return endLng;
    }

    public void setEndLng(Double endLng) {
        this.endLng = endLng;
    }

    public String getTotalDistance() {
        return totalDistance;
    }

    public void setTotalDistance(String totalDistance) {
        this.totalDistance = totalDistance;
    }

    public String getTotalDuration() {
        return totalDuration;
    }

    public void setTotalDuration(String totalDuration) {
        this.totalDuration = totalDuration;
    }

    public String getTravelMode() {
        return travelMode;
    }

    public void setTravelMode(String travelMode) {
        this.travelMode = travelMode;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Integer getRoutePointsCount() {
        return routePointsCount;
    }

    public void setRoutePointsCount(Integer routePointsCount) {
        this.routePointsCount = routePointsCount;
    }

    public List<RoutePoint> getRoutePoints() {
        return routePoints;
    }

    public void setRoutePoints(List<RoutePoint> routePoints) {
        this.routePoints = routePoints != null ? routePoints : new ArrayList<>();
        this.routePointsCount = this.routePoints.size();
    }

    public List<Map<String, Object>> getDestinations() {
        return destinations;
    }

    public void setDestinations(List<Map<String, Object>> destinations) {
        this.destinations = destinations != null ? destinations : new ArrayList<>();
    }

    public Integer getSavedLocationsCount() {
        return savedLocationsCount;
    }

    public void setSavedLocationsCount(Integer savedLocationsCount) {
        this.savedLocationsCount = savedLocationsCount;
    }
}
