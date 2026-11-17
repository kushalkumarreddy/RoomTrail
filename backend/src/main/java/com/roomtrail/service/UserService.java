package com.roomtrail.service;

import com.roomtrail.dto.TrackingPreferencesDto;
import com.roomtrail.dto.UserProfileDto;
import com.roomtrail.entity.User;
import com.roomtrail.exception.BadRequestException;
import com.roomtrail.exception.ResourceNotFoundException;
import com.roomtrail.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UserProfileDto getProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
        return UserProfileDto.fromEntity(user);
    }

    @Transactional
    public UserProfileDto updateProfile(Long userId, Map<String, Object> updates) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        if (updates.containsKey("fullName")) user.setFullName((String) updates.get("fullName"));
        if (updates.containsKey("phone")) user.setPhone((String) updates.get("phone"));
        if (updates.containsKey("bio")) user.setBio((String) updates.get("bio"));
        if (updates.containsKey("city")) user.setCity((String) updates.get("city"));
        if (updates.containsKey("travelMode")) user.setTravelMode((String) updates.get("travelMode"));
        if (updates.containsKey("notificationRadiusMeters") && updates.get("notificationRadiusMeters") != null) {
            user.setNotificationRadiusMeters(((Number) updates.get("notificationRadiusMeters")).intValue());
        }
        if (updates.containsKey("themePreference")) user.setThemePreference((String) updates.get("themePreference"));

        if (updates.containsKey("homeCoordinates") && updates.get("homeCoordinates") instanceof Map<?, ?> coords) {
            if (coords.containsKey("lat") && coords.get("lat") != null) {
                user.setHomeLat(((Number) coords.get("lat")).doubleValue());
            }
            if (coords.containsKey("lng") && coords.get("lng") != null) {
                user.setHomeLng(((Number) coords.get("lng")).doubleValue());
            }
        }

        User saved = userRepository.save(user);
        return UserProfileDto.fromEntity(saved);
    }

    public TrackingPreferencesDto getTrackingPreferences(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
        return TrackingPreferencesDto.fromUser(user);
    }

    @Transactional
    public TrackingPreferencesDto updateTrackingPreferences(Long userId, TrackingPreferencesDto dto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        if (dto.getTrackingConfirmation() != null) {
            user.setTrackingConfirmation(dto.getTrackingConfirmation());
        }

        if (dto.getAccuracyWarningMeters() != null) {
            int meters = dto.getAccuracyWarningMeters();
            List<Integer> allowedAccuracies = Arrays.asList(25, 50, 100);
            if (!allowedAccuracies.contains(meters)) {
                throw new BadRequestException("accuracyWarningMeters must be 25, 50, or 100");
            }
            user.setAccuracyWarningMeters(meters);
        }

        if (dto.getTrackingReminderMinutes() != null) {
            int mins = dto.getTrackingReminderMinutes();
            List<Integer> allowedReminders = Arrays.asList(0, 30, 60, 120);
            if (!allowedReminders.contains(mins)) {
                throw new BadRequestException("trackingReminderMinutes must be 0 (disabled), 30, 60, or 120");
            }
            user.setTrackingReminderMinutes(mins);
        }

        if (dto.getPrivacyReminderAcknowledged() != null) {
            user.setPrivacyReminderAcknowledged(dto.getPrivacyReminderAcknowledged());
        }

        User saved = userRepository.save(user);
        return TrackingPreferencesDto.fromUser(saved);
    }
}
