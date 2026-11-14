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
@RequestMapping({"/api/tripSummaries", "/api/trip-summaries"})
public class TripSummaryController {

    private final TripSummaryService tripSummaryService;

    public TripSummaryController(TripSummaryService tripSummaryService) {
        this.tripSummaryService = tripSummaryService;
    }

    @GetMapping
    public ResponseEntity<List<TripSummary>> getAllSummaries(@RequestParam(required = false) String tripId,
                                                             @RequestParam(required = false) Long userId,
                                                             Authentication authentication) {
        if (tripId != null && !tripId.trim().isEmpty()) {
            return ResponseEntity.ok(
                    tripSummaryService.getByTripId(tripId)
                            .map(Collections::singletonList)
                            .orElse(Collections.emptyList())
            );
        }
        Long effectiveUserId = userId != null ? userId : getUserId(authentication);
        return ResponseEntity.ok(tripSummaryService.getAll(effectiveUserId));
    }

    @GetMapping("/metrics")
    public ResponseEntity<AggregatedMetricsDto> getMetrics(@RequestParam(required = false) Long userId,
                                                           Authentication authentication) {
        Long effectiveUserId = userId != null ? userId : getUserId(authentication);
        return ResponseEntity.ok(tripSummaryService.getAggregatedMetrics(effectiveUserId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TripSummary> getSummaryById(@PathVariable String id) {
        return ResponseEntity.ok(tripSummaryService.getById(id));
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
}
