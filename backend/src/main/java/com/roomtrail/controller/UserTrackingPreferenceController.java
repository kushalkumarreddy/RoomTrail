package com.roomtrail.controller;

import com.roomtrail.dto.TrackingPreferencesDto;
import com.roomtrail.security.UserPrincipal;
import com.roomtrail.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/user/tracking-preferences", "/api/users/tracking-preferences"})
public class UserTrackingPreferenceController {

    private final UserService userService;

    public UserTrackingPreferenceController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<TrackingPreferencesDto> getTrackingPreferences(Authentication authentication) {
        Long userId = getUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(userService.getTrackingPreferences(userId));
    }

    @PutMapping
    public ResponseEntity<TrackingPreferencesDto> updateTrackingPreferences(
            @RequestBody TrackingPreferencesDto preferencesDto,
            Authentication authentication) {
        Long userId = getUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(userService.updateTrackingPreferences(userId, preferencesDto));
    }

    private Long getUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal up) {
            return up.getId();
        }
        return null;
    }
}
