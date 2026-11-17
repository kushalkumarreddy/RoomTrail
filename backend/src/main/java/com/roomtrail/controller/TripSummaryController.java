package com.roomtrail.controller;

import com.roomtrail.dto.AggregatedMetricsDto;
import com.roomtrail.entity.TripSummary;
import com.roomtrail.security.UserPrincipal;
import com.roomtrail.service.TripSummaryService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api/tripSummaries")
public class TripSummaryController {

    private final TripSummaryService tripSummaryService;

    public TripSummaryController(TripSummaryService tripSummaryService) {
        this.tripSummaryService = tripSummaryService;
    }

    @GetMapping
    public ResponseEntity<List<TripSummary>> getAllSummaries(@RequestParam(required = false) String tripId,
                                                             @RequestParam(required = false) Long userId,
                                                             Authentication authentication) {
        Long authenticatedId = getUserId(authentication);
        boolean admin = isAdmin(authentication);

        if (tripId != null && !tripId.trim().isEmpty()) {
            return ResponseEntity.ok(
                    tripSummaryService.getByTripId(tripId)
                            .filter(s -> admin || isOwner(s.getUserId(), authenticatedId))
                            .map(Collections::singletonList)
                            .orElse(Collections.emptyList())
            );
        }
        Long effectiveUserId = admin ? userId : authenticatedId;
        return ResponseEntity.ok(tripSummaryService.getAll(effectiveUserId));
    }

    @GetMapping("/metrics")
    public ResponseEntity<AggregatedMetricsDto> getMetrics(@RequestParam(required = false) Long userId,
                                                           Authentication authentication) {
        Long authenticatedId = getUserId(authentication);
        boolean admin = isAdmin(authentication);
        Long effectiveUserId = admin ? userId : authenticatedId;
        return ResponseEntity.ok(tripSummaryService.getAggregatedMetrics(effectiveUserId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TripSummary> getSummaryById(@PathVariable String id, Authentication authentication) {
        TripSummary summary = tripSummaryService.getById(id);
        if (summary == null) {
            return ResponseEntity.notFound().build();
        }
        Long authenticatedId = getUserId(authentication);
        if (!isAdmin(authentication) && !isOwner(summary.getUserId(), authenticatedId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(summary);
    }

    @PostMapping
    public ResponseEntity<TripSummary> createSummary(@RequestBody TripSummary summary,
                                                     Authentication authentication) {
        Long userId = getUserId(authentication);
        TripSummary created = tripSummaryService.create(summary, userId);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
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

    private boolean isOwner(String entityUserId, Long authenticatedId) {
        if (authenticatedId == null) return false;
        if (entityUserId == null) return true;
        try {
            return Long.parseLong(entityUserId.trim()) == authenticatedId;
        } catch (NumberFormatException e) {
            return entityUserId.trim().equalsIgnoreCase(String.valueOf(authenticatedId));
        }
    }
}
