package com.roomtrail.controller;

import com.roomtrail.dto.UserProfileDto;
import com.roomtrail.security.UserPrincipal;
import com.roomtrail.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/profile")
    public ResponseEntity<UserProfileDto> getProfile(Authentication authentication) {
        Long userId = getUserId(authentication);
        return ResponseEntity.ok(userService.getProfile(userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserProfileDto> getProfileById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getProfile(id));
    }

    @PutMapping("/profile")
    public ResponseEntity<UserProfileDto> updateProfile(@RequestBody Map<String, Object> updates,
                                                        Authentication authentication) {
        Long userId = getUserId(authentication);
        return ResponseEntity.ok(userService.updateProfile(userId, updates));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<UserProfileDto> patchProfileById(@PathVariable Long id,
                                                           @RequestBody Map<String, Object> updates) {
        return ResponseEntity.ok(userService.updateProfile(id, updates));
    }

    private Long getUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal up) {
            return up.getId();
        }
        return 1L; // Fallback default
    }
}
