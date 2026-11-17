package com.roomtrail.dto;

import java.util.ArrayList;
import java.util.List;

public class TripTimelineDto {

    private String tripId;
    private String tripName;
    private String title;
    private String status;
    private String startTime;
    private String startTimeFormatted;
    private String endTime;
    private String endTimeFormatted;
    private String startLocation;
    private String endLocation;
    private Double startLat;
    private Double startLng;
    private Double endLat;
    private Double endLng;
    private String totalDistance;
    private String totalDuration;
    private Integer totalStopsCount;
    private Boolean hasRoutePoints;
    private Integer routePointsCount;
    private List<TripTimelineStopDto> stops = new ArrayList<>();

    public TripTimelineDto() {}

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

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getStartTime() {
        return startTime;
    }

    public void setStartTime(String startTime) {
        this.startTime = startTime;
    }

    public String getStartTimeFormatted() {
        return startTimeFormatted;
    }

    public void setStartTimeFormatted(String startTimeFormatted) {
        this.startTimeFormatted = startTimeFormatted;
    }

    public String getEndTime() {
        return endTime;
    }

    public void setEndTime(String endTime) {
        this.endTime = endTime;
    }

    public String getEndTimeFormatted() {
        return endTimeFormatted;
    }

    public void setEndTimeFormatted(String endTimeFormatted) {
        this.endTimeFormatted = endTimeFormatted;
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

    public Integer getTotalStopsCount() {
        return totalStopsCount;
    }

    public void setTotalStopsCount(Integer totalStopsCount) {
        this.totalStopsCount = totalStopsCount;
    }

    public Boolean getHasRoutePoints() {
        return hasRoutePoints != null ? hasRoutePoints : false;
    }

    public void setHasRoutePoints(Boolean hasRoutePoints) {
        this.hasRoutePoints = hasRoutePoints;
    }

    public Integer getRoutePointsCount() {
        return routePointsCount;
    }

    public void setRoutePointsCount(Integer routePointsCount) {
        this.routePointsCount = routePointsCount;
    }

    public List<TripTimelineStopDto> getStops() {
        return stops;
    }

    public void setStops(List<TripTimelineStopDto> stops) {
        this.stops = stops != null ? stops : new ArrayList<>();
    }
}
