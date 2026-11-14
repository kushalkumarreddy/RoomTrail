package com.roomtrail.dto;

import com.roomtrail.entity.User;
import java.util.HashMap;
import java.util.Map;

public class UserProfileDto {

    private String id;
    private String username;
    private String email;
    private String fullName;
    private String phone;
    private String role;
    private String bio;
    private String travelMode;
    private String city;
    private Map<String, Double> homeCoordinates;
    private Integer notificationRadiusMeters;
    private String themePreference;
    private String createdAt;

    public UserProfileDto() {}

    public static UserProfileDto fromEntity(User user) {
        if (user == null) return null;
        UserProfileDto dto = new UserProfileDto();
        dto.setId(String.valueOf(user.getId()));
        dto.setUsername(user.getUsername());
        dto.setEmail(user.getEmail());
        dto.setFullName(user.getFullName());
        dto.setPhone(user.getPhone());
        dto.setRole(user.getRole());
        dto.setBio(user.getBio());
        dto.setTravelMode(user.getTravelMode());
        dto.setCity(user.getCity());

        Map<String, Double> coords = new HashMap<>();
        coords.put("lat", user.getHomeLat() != null ? user.getHomeLat() : 12.9716);
        coords.put("lng", user.getHomeLng() != null ? user.getHomeLng() : 77.5946);
        dto.setHomeCoordinates(coords);

        dto.setNotificationRadiusMeters(user.getNotificationRadiusMeters());
        dto.setThemePreference(user.getThemePreference());
        dto.setCreatedAt(user.getCreatedAt() != null ? user.getCreatedAt().toString() : null);

        return dto;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }

    public String getTravelMode() { return travelMode; }
    public void setTravelMode(String travelMode) { this.travelMode = travelMode; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public Map<String, Double> getHomeCoordinates() { return homeCoordinates; }
    public void setHomeCoordinates(Map<String, Double> homeCoordinates) { this.homeCoordinates = homeCoordinates; }

    public Integer getNotificationRadiusMeters() { return notificationRadiusMeters; }
    public void setNotificationRadiusMeters(Integer notificationRadiusMeters) { this.notificationRadiusMeters = notificationRadiusMeters; }

    public String getThemePreference() { return themePreference; }
    public void setThemePreference(String themePreference) { this.themePreference = themePreference; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
