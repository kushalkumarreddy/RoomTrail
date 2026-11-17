package com.roomtrail.controller;

import com.roomtrail.dto.AdminUserSummaryDto;
import com.roomtrail.entity.AdminAuditLog;
import com.roomtrail.entity.Trip;
import com.roomtrail.entity.User;
import com.roomtrail.repository.*;
import com.roomtrail.security.UserPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final UserRepository userRepository;
    private final PropertyRepository propertyRepository;
    private final TripRepository tripRepository;
    private final VisitRepository visitRepository;
    private final RoutePointRepository routePointRepository;
    private final TripSummaryRepository tripSummaryRepository;
    private final AdminAuditLogRepository auditLogRepository;

    public AdminController(UserRepository userRepository,
                           PropertyRepository propertyRepository,
                           TripRepository tripRepository,
                           VisitRepository visitRepository,
                           RoutePointRepository routePointRepository,
                           TripSummaryRepository tripSummaryRepository,
                           AdminAuditLogRepository auditLogRepository) {
        this.userRepository = userRepository;
        this.propertyRepository = propertyRepository;
        this.tripRepository = tripRepository;
        this.visitRepository = visitRepository;
        this.routePointRepository = routePointRepository;
        this.tripSummaryRepository = tripSummaryRepository;
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * Aggregated metrics for Admin Dashboard (Zero PII)
     */
    @GetMapping("/metrics")
    public ResponseEntity<Map<String, Object>> getAdminMetrics() {
        long totalUsers = userRepository.count();
        long deactivatedUsers = userRepository.countByStatus("DEACTIVATED");
        long activeUsers = Math.max(0, totalUsers - deactivatedUsers);

        Map<String, Object> health = new HashMap<>();
        health.put("status", "HEALTHY");
        health.put("database", "CONNECTED");
        health.put("security", "ENFORCED");
        health.put("timestamp", LocalDateTime.now());

        Map<String, Object> metrics = new HashMap<>();
        metrics.put("totalUsers", totalUsers);
        metrics.put("activeAccounts", activeUsers);
        metrics.put("deactivatedAccounts", deactivatedUsers);
        metrics.put("totalProperties", propertyRepository.count());
        metrics.put("totalTrips", tripRepository.count());
        metrics.put("totalVisits", visitRepository.count());
        metrics.put("applicationHealth", health);

        return ResponseEntity.ok(metrics);
    }

    /**
     * View all registered accounts with strictly anonymized summary (Zero PII)
     */
    @GetMapping("/users")
    public ResponseEntity<List<AdminUserSummaryDto>> getAllUsers() {
        List<User> users = userRepository.findAll();
        List<AdminUserSummaryDto> summaries = users.stream().map(u -> {
            String roleName = u.getRole() != null ? u.getRole().replace("ROLE_", "").toUpperCase() : "USER";
            String refPrefix = "ADMIN".equalsIgnoreCase(roleName) ? "ADM-" : "USR-";
            String accountRef = refPrefix + String.format("%03d", u.getId());
            String status = u.getStatus() != null && !u.getStatus().isBlank() ? u.getStatus().toUpperCase() : "ACTIVE";
            long roomsCount = propertyRepository.countByUserId(u.getId());
            long tripsCount = tripRepository.countByUserId(u.getId());

            return new AdminUserSummaryDto(
                    u.getId(),
                    accountRef,
                    roleName,
                    status,
                    u.getCreatedAt(),
                    roomsCount,
                    tripsCount
            );
        }).collect(Collectors.toList());

        return ResponseEntity.ok(summaries);
    }

    /**
     * Platform Overview aggregates (Zero PII)
     */
    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> getPlatformOverview() {
        Map<String, Object> overview = new HashMap<>();

        // Room statistics
        overview.put("totalRooms", propertyRepository.count());
        Map<String, Long> categoryMap = new HashMap<>();
        for (Object[] row : propertyRepository.countGroupByCategory()) {
            String cat = row[0] != null ? row[0].toString() : "uncategorized";
            Long count = (Long) row[1];
            categoryMap.put(cat, count);
        }
        overview.put("roomsByCategory", categoryMap);

        // Trip statistics
        overview.put("totalTrips", tripRepository.count());
        Map<String, Long> statusMap = new HashMap<>();
        for (Object[] row : tripRepository.countGroupByStatus()) {
            String st = row[0] != null ? row[0].toString() : "unknown";
            Long count = (Long) row[1];
            statusMap.put(st, count);
        }
        overview.put("tripsByStatus", statusMap);

        // Account statistics
        long totalAccounts = userRepository.count();
        long deactivatedAccounts = userRepository.countByStatus("DEACTIVATED");
        overview.put("totalAccounts", totalAccounts);
        overview.put("deactivatedAccounts", deactivatedAccounts);
        overview.put("activeAccounts", Math.max(0, totalAccounts - deactivatedAccounts));
        overview.put("totalVisits", visitRepository.count());

        return ResponseEntity.ok(overview);
    }

    /**
     * Toggle account status (ACTIVE <-> DEACTIVATED)
     */
    @PutMapping("/users/{id}/status")
    public ResponseEntity<?> updateUserStatus(@PathVariable Long id,
                                              @RequestBody Map<String, String> body,
                                              Authentication authentication) {
        String newStatus = body.get("status");
        if (newStatus == null || (!newStatus.equalsIgnoreCase("ACTIVE") && !newStatus.equalsIgnoreCase("DEACTIVATED"))) {
            return ResponseEntity.badRequest().body(Map.of("message", "Status must be either 'ACTIVE' or 'DEACTIVATED'."));
        }

        Optional<User> optionalUser = userRepository.findById(id);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User targetUser = optionalUser.get();
        Long currentAdminId = getUserId(authentication);
        String currentAdminRef = "ADM-" + String.format("%03d", currentAdminId != null ? currentAdminId : 0);
        String targetRef = (targetUser.getRole() != null && targetUser.getRole().toUpperCase().contains("ADMIN") ? "ADM-" : "USR-")
                + String.format("%03d", targetUser.getId());

        // Guard 1: Admin cannot deactivate own account
        if ("DEACTIVATED".equalsIgnoreCase(newStatus) && currentAdminId != null && currentAdminId.equals(targetUser.getId())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Administrators cannot deactivate their own account."));
        }

        // Guard 2: Cannot deactivate the last active administrator
        if ("DEACTIVATED".equalsIgnoreCase(newStatus) && targetUser.getRole() != null && targetUser.getRole().toUpperCase().contains("ADMIN")) {
            long activeAdmins = userRepository.countActiveAdmins();
            if (activeAdmins <= 1) {
                return ResponseEntity.badRequest().body(Map.of("message", "Cannot deactivate the last active administrator."));
            }
        }

        targetUser.setStatus(newStatus.toUpperCase());
        userRepository.save(targetUser);

        // Record minimal audit log (Zero PII)
        AdminAuditLog log = new AdminAuditLog(
                currentAdminRef,
                "DEACTIVATED".equalsIgnoreCase(newStatus) ? "DEACTIVATE_ACCOUNT" : "REACTIVATE_ACCOUNT",
                targetRef,
                "SUCCESS",
                "Account " + ("DEACTIVATED".equalsIgnoreCase(newStatus) ? "deactivated" : "reactivated") + " by administrator."
        );
        auditLogRepository.save(log);

        return ResponseEntity.ok(Map.of(
                "message", "Account " + targetRef + " successfully " + ("DEACTIVATED".equalsIgnoreCase(newStatus) ? "deactivated" : "reactivated") + ".",
                "status", targetUser.getStatus(),
                "accountRef", targetRef
        ));
    }

    /**
     * Permanently delete a user account and all associated records (Cascade delete in atomic transaction)
     */
    @DeleteMapping("/users/{id}")
    @Transactional
    public ResponseEntity<?> deleteUserAccount(@PathVariable Long id, Authentication authentication) {
        Optional<User> optionalUser = userRepository.findById(id);
        if (optionalUser.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User targetUser = optionalUser.get();
        Long currentAdminId = getUserId(authentication);
        String currentAdminRef = "ADM-" + String.format("%03d", currentAdminId != null ? currentAdminId : 0);
        String targetRef = (targetUser.getRole() != null && targetUser.getRole().toUpperCase().contains("ADMIN") ? "ADM-" : "USR-")
                + String.format("%03d", targetUser.getId());

        // Guard 1: Admin cannot delete own account
        if (currentAdminId != null && currentAdminId.equals(targetUser.getId())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Administrators cannot delete their own account."));
        }

        // Guard 2: Cannot delete the last active administrator
        if (targetUser.getRole() != null && targetUser.getRole().toUpperCase().contains("ADMIN")) {
            long activeAdmins = userRepository.countActiveAdmins();
            if (activeAdmins <= 1) {
                return ResponseEntity.badRequest().body(Map.of("message", "Cannot delete the last active administrator."));
            }
        }

        // Cascade delete: route points -> trip summaries -> visits -> trips -> properties -> user
        List<Trip> userTrips = tripRepository.findByUserId(id);
        if (userTrips != null && !userTrips.isEmpty()) {
            List<String> tripIds = userTrips.stream().map(Trip::getId).collect(Collectors.toList());
            routePointRepository.deleteByTripIdIn(tripIds);
            for (String tripId : tripIds) {
                tripSummaryRepository.deleteByTripId(tripId);
            }
        }
        tripSummaryRepository.deleteByUserId(id);
        visitRepository.deleteByUserId(id);
        tripRepository.deleteByUserId(id);
        propertyRepository.deleteByUserId(id);
        userRepository.delete(targetUser);

        // Record minimal audit log (Zero PII)
        AdminAuditLog log = new AdminAuditLog(
                currentAdminRef,
                "DELETE_ACCOUNT",
                targetRef,
                "SUCCESS",
                "Account permanently deleted along with all associated route points, trips, visits, and saved rooms."
        );
        auditLogRepository.save(log);

        return ResponseEntity.ok(Map.of(
                "message", "Account " + targetRef + " and all associated records permanently deleted.",
                "accountRef", targetRef
        ));
    }

    /**
     * Fetch administrative audit logs (Zero PII)
     */
    @GetMapping("/audit-logs")
    public ResponseEntity<List<AdminAuditLog>> getAuditLogs() {
        return ResponseEntity.ok(auditLogRepository.findTop50ByOrderByTimestampDesc());
    }

    private Long getUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal up) {
            return up.getId();
        }
        return null;
    }
}
