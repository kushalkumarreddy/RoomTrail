package com.roomtrail.dto;

import com.roomtrail.entity.User;

public class TrackingPreferencesDto {

    private Boolean trackingConfirmation = true;
    private Integer accuracyWarningMeters = 50;
    private Integer trackingReminderMinutes = 60;
    private Boolean privacyReminderAcknowledged = true;
    private String privacyNotice = "Recorded routes contain sensitive location information and are stored securely in your RoomTrail account.";

    public TrackingPreferencesDto() {}

    public TrackingPreferencesDto(Boolean trackingConfirmation, Integer accuracyWarningMeters,
                                  Integer trackingReminderMinutes, Boolean privacyReminderAcknowledged) {
        this.trackingConfirmation = trackingConfirmation != null ? trackingConfirmation : true;
        this.accuracyWarningMeters = accuracyWarningMeters != null ? accuracyWarningMeters : 50;
        this.trackingReminderMinutes = trackingReminderMinutes != null ? trackingReminderMinutes : 60;
        this.privacyReminderAcknowledged = privacyReminderAcknowledged != null ? privacyReminderAcknowledged : true;
    }

    public static TrackingPreferencesDto fromUser(User user) {
        if (user == null) return new TrackingPreferencesDto();
        TrackingPreferencesDto dto = new TrackingPreferencesDto();
        dto.setTrackingConfirmation(user.getTrackingConfirmation());
        dto.setAccuracyWarningMeters(user.getAccuracyWarningMeters());
        dto.setTrackingReminderMinutes(user.getTrackingReminderMinutes());
        dto.setPrivacyReminderAcknowledged(user.getPrivacyReminderAcknowledged());
        return dto;
    }

    public Boolean getTrackingConfirmation() {
        return trackingConfirmation != null ? trackingConfirmation : true;
    }

    public void setTrackingConfirmation(Boolean trackingConfirmation) {
        this.trackingConfirmation = trackingConfirmation;
    }

    public Integer getAccuracyWarningMeters() {
        return accuracyWarningMeters != null ? accuracyWarningMeters : 50;
    }

    public void setAccuracyWarningMeters(Integer accuracyWarningMeters) {
        this.accuracyWarningMeters = accuracyWarningMeters;
    }

    public Integer getTrackingReminderMinutes() {
        return trackingReminderMinutes != null ? trackingReminderMinutes : 60;
    }

    public void setTrackingReminderMinutes(Integer trackingReminderMinutes) {
        this.trackingReminderMinutes = trackingReminderMinutes;
    }

    public Boolean getPrivacyReminderAcknowledged() {
        return privacyReminderAcknowledged != null ? privacyReminderAcknowledged : true;
    }

    public void setPrivacyReminderAcknowledged(Boolean privacyReminderAcknowledged) {
        this.privacyReminderAcknowledged = privacyReminderAcknowledged;
    }

    public String getPrivacyNotice() {
        return privacyNotice;
    }

    public void setPrivacyNotice(String privacyNotice) {
        this.privacyNotice = privacyNotice;
    }
}
