package com.roomtrail.controller;

import com.roomtrail.dto.TripRouteHistoryDto;
import com.roomtrail.dto.TripTimelineDto;
import com.roomtrail.entity.RoutePoint;
import com.roomtrail.entity.Trip;
import com.roomtrail.security.UserPrincipal;
import com.roomtrail.service.RoutePointService;
import com.roomtrail.service.TripService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/trips")
public class TripController {

    private final TripService tripService;
    private final RoutePointService routePointService;

    public TripController(TripService tripService, RoutePointService routePointService) {
        this.tripService = tripService;
        this.routePointService = routePointService;
    }

    @GetMapping
    public ResponseEntity<List<Trip>> getAllTrips(@RequestParam(required = false) Long userId,
                                                  @RequestParam(required = false) String status,
                                                  Authentication authentication) {
        Long authenticatedId = getUserId(authentication);
        boolean admin = isAdmin(authentication);
        Long effectiveUserId = admin ? userId : authenticatedId;
        return ResponseEntity.ok(tripService.getAll(effectiveUserId, status));
    }

    @GetMapping("/history/routes")
    public ResponseEntity<List<TripRouteHistoryDto>> getTripRouteHistories(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String tripId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            Authentication authentication) {
        Long authenticatedId = getUserId(authentication);
        boolean admin = isAdmin(authentication);
        Long effectiveUserId = admin ? (userId != null ? userId : authenticatedId) : authenticatedId;
        return ResponseEntity.ok(tripService.getTripRouteHistories(effectiveUserId, tripId, startDate, endDate));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Trip> getTripById(@PathVariable String id, Authentication authentication) {
        Trip trip = tripService.getById(id);
        if (trip == null) {
            return ResponseEntity.notFound().build();
        }
        Long authenticatedId = getUserId(authentication);
        if (!isAdmin(authentication) && !isOwner(trip.getUserId(), authenticatedId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(trip);
    }

    @PostMapping
    public ResponseEntity<Trip> createTrip(@RequestBody Trip trip,
                                           Authentication authentication) {
        Long userId = getUserId(authentication);
        Trip created = tripService.create(trip, userId);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<Trip> patchTrip(@PathVariable String id,
                                          @RequestBody Map<String, Object> updates,
                                          Authentication authentication) {
        Trip trip = tripService.getById(id);
        if (trip == null) {
            return ResponseEntity.notFound().build();
        }
        Long authenticatedId = getUserId(authentication);
        if (!isAdmin(authentication) && !isOwner(trip.getUserId(), authenticatedId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(tripService.update(id, updates));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Trip> updateTrip(@PathVariable String id,
                                           @RequestBody Map<String, Object> updates,
                                           Authentication authentication) {
        Trip trip = tripService.getById(id);
        if (trip == null) {
            return ResponseEntity.notFound().build();
        }
        Long authenticatedId = getUserId(authentication);
        if (!isAdmin(authentication) && !isOwner(trip.getUserId(), authenticatedId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(tripService.update(id, updates));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTrip(@PathVariable String id, Authentication authentication) {
        Long authenticatedId = getUserId(authentication);
        if (authenticatedId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (isAdmin(authentication)) {
            // Admins are prohibited from modifying or deleting private user trips
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Trip trip = tripService.getById(id);
        if (trip == null) {
            return ResponseEntity.notFound().build();
        }
        if (!isOwner(trip.getUserId(), authenticatedId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        tripService.deleteTripWithRelated(id, authenticatedId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/timeline")
    public ResponseEntity<TripTimelineDto> getTripTimeline(@PathVariable String id, Authentication authentication) {
        Trip trip = tripService.getById(id);
        if (trip == null) {
            return ResponseEntity.notFound().build();
        }
        Long authenticatedId = getUserId(authentication);
        if (authenticatedId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        // Personal notes and trip timelines are strictly isolated to the trip owner
        if (!isOwner(trip.getUserId(), authenticatedId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        TripTimelineDto timeline = tripService.getTripTimeline(id, authenticatedId);
        if (timeline == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(timeline);
    }

    @GetMapping("/{tripId}/route-points")
    public ResponseEntity<List<RoutePoint>> getTripRoutePoints(@PathVariable String tripId, Authentication authentication) {
        Long authenticatedId = getUserId(authentication);
        if (authenticatedId == null && !isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Trip trip = tripService.getById(tripId);
        if (trip == null) {
            return ResponseEntity.notFound().build();
        }
        if (!isAdmin(authentication) && !isOwner(trip.getUserId(), authenticatedId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(routePointService.getAll(tripId));
    }

    @PostMapping("/{tripId}/route-points")
    public ResponseEntity<RoutePoint> createTripRoutePoint(@PathVariable String tripId,
                                                           @RequestBody RoutePoint point,
                                                           Authentication authentication) {
        Long authenticatedId = getUserId(authentication);
        if (authenticatedId == null && !isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Trip trip = tripService.getById(tripId);
        if (trip == null) {
            return ResponseEntity.notFound().build();
        }
        if (!isAdmin(authentication) && !isOwner(trip.getUserId(), authenticatedId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        if (point.getTripId() == null || point.getTripId().trim().isEmpty()) {
            point.setTripId(tripId);
        }
        RoutePoint created = routePointService.create(point);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @PostMapping("/{tripId}/route-points/batch")
    public ResponseEntity<List<RoutePoint>> createTripRoutePointsBatch(@PathVariable String tripId,
                                                                       @RequestBody List<RoutePoint> points,
                                                                       Authentication authentication) {
        Long authenticatedId = getUserId(authentication);
        if (authenticatedId == null && !isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Trip trip = tripService.getById(tripId);
        if (trip == null) {
            return ResponseEntity.notFound().build();
        }
        if (!isAdmin(authentication) && !isOwner(trip.getUserId(), authenticatedId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        List<RoutePoint> saved = routePointService.saveBatch(tripId, points);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
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
        if (entityUserId == null) return false;
        try {
            return Long.parseLong(entityUserId.trim()) == authenticatedId;
        } catch (NumberFormatException e) {
            return entityUserId.trim().equalsIgnoreCase(String.valueOf(authenticatedId));
        }
    }
}
