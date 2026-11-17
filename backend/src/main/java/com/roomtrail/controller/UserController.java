package com.roomtrail.controller;

import com.roomtrail.dto.UserProfileDto;
import com.roomtrail.security.UserPrincipal;
import com.roomtrail.service.UserService;
import org.springframework.http.HttpStatus;
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
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(userService.getProfile(userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserProfileDto> getProfileById(@PathVariable Long id, Authentication authentication) {
        Long authenticatedId = getUserId(authentication);
        boolean admin = isAdmin(authentication);
        if (!admin && (authenticatedId == null || !id.equals(authenticatedId))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(userService.getProfile(id));
    }

    @PutMapping("/profile")
    public ResponseEntity<UserProfileDto> updateProfile(@RequestBody Map<String, Object> updates,
                                                        Authentication authentication) {
        Long userId = getUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(userService.updateProfile(userId, updates));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<UserProfileDto> patchProfileById(@PathVariable Long id,
                                                           @RequestBody Map<String, Object> updates,
                                                           Authentication authentication) {
        Long authenticatedId = getUserId(authentication);
        boolean admin = isAdmin(authentication);
        if (!admin && (authenticatedId == null || !id.equals(authenticatedId))) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(userService.updateProfile(id, updates));
    }

    private Long getUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal up) {
            return up.getId();
        }
        return null;
    }

    private boolean isAdmin(Authentication authentication) {
        if (authentication == null) return false;
        return authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_ADMIN") || a.getAuthority().equalsIgnoreCase("ADMIN"));
    }
}
