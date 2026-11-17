package com.roomtrail.dto;

public class TripTimelineStopDto {

    private String id;
    private Integer stopNumber;
    private String propertyId;
    private String locationName;
    private String category;
    private String address;
    private String arrivalTime;
    private String arrivalTimeFormatted;
    private String departureTime;
    private String departureTimeFormatted;
    private String duration;
    private Long durationMinutes;
    private Boolean isActiveStop;
    private String notes;
    private Double latitude;
    private Double longitude;
    private Boolean isRevisit;

    public TripTimelineStopDto() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Integer getStopNumber() {
        return stopNumber;
    }

    public void setStopNumber(Integer stopNumber) {
        this.stopNumber = stopNumber;
    }

    public String getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(String propertyId) {
        this.propertyId = propertyId;
    }

    public String getLocationName() {
        return locationName;
    }

    public void setLocationName(String locationName) {
        this.locationName = locationName;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getArrivalTime() {
        return arrivalTime;
    }

    public void setArrivalTime(String arrivalTime) {
        this.arrivalTime = arrivalTime;
    }

    public String getArrivalTimeFormatted() {
        return arrivalTimeFormatted;
    }

    public void setArrivalTimeFormatted(String arrivalTimeFormatted) {
        this.arrivalTimeFormatted = arrivalTimeFormatted;
    }

    public String getDepartureTime() {
        return departureTime;
    }

    public void setDepartureTime(String departureTime) {
        this.departureTime = departureTime;
    }

    public String getDepartureTimeFormatted() {
        return departureTimeFormatted;
    }

    public void setDepartureTimeFormatted(String departureTimeFormatted) {
        this.departureTimeFormatted = departureTimeFormatted;
    }

    public String getDuration() {
        return duration;
    }

    public void setDuration(String duration) {
        this.duration = duration;
    }

    public Long getDurationMinutes() {
        return durationMinutes;
    }

    public void setDurationMinutes(Long durationMinutes) {
        this.durationMinutes = durationMinutes;
    }

    public Boolean getIsActiveStop() {
        return isActiveStop != null ? isActiveStop : false;
    }

    public void setIsActiveStop(Boolean isActiveStop) {
        this.isActiveStop = isActiveStop;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public Boolean getIsRevisit() {
        return isRevisit != null ? isRevisit : false;
    }

    public void setIsRevisit(Boolean isRevisit) {
        this.isRevisit = isRevisit;
    }
}
