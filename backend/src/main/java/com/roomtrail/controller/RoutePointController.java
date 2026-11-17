package com.roomtrail.controller;

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

@RestController
@RequestMapping("/api/route-points")
public class RoutePointController {

    private final RoutePointService routePointService;
    private final TripService tripService;

    public RoutePointController(RoutePointService routePointService, TripService tripService) {
        this.routePointService = routePointService;
        this.tripService = tripService;
    }

    @GetMapping
    public ResponseEntity<List<RoutePoint>> getRoutePoints(
            @RequestParam(required = false) String tripId,
            @RequestParam(required = false) String excludeTripId,
            Authentication authentication) {
        Long authenticatedId = getUserId(authentication);
        boolean admin = isAdmin(authentication);

        if (tripId != null && !tripId.trim().isEmpty()) {
            Trip trip = tripService.getById(tripId);
            if (trip != null && !admin && !isOwner(trip.getUserId(), authenticatedId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            return ResponseEntity.ok(routePointService.getAll(tripId, excludeTripId));
        }

        if (admin) {
            return ResponseEntity.ok(routePointService.getAll(null, excludeTripId));
        }
        return ResponseEntity.ok(routePointService.getAllForUser(authenticatedId, excludeTripId));
    }

    @PostMapping
    public ResponseEntity<RoutePoint> createRoutePoint(@RequestBody RoutePoint point,
                                                       Authentication authentication) {
        Long authenticatedId = getUserId(authentication);
        boolean admin = isAdmin(authentication);

        if (point.getTripId() != null && !point.getTripId().trim().isEmpty()) {
            Trip trip = tripService.getById(point.getTripId());
            if (trip != null && !admin && !isOwner(trip.getUserId(), authenticatedId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
        }

        RoutePoint created = routePointService.create(point);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @DeleteMapping("/trip/{tripId}")
    public ResponseEntity<Void> deleteByTripId(@PathVariable String tripId, Authentication authentication) {
        Long authenticatedId = getUserId(authentication);
        boolean admin = isAdmin(authentication);

        Trip trip = tripService.getById(tripId);
        if (trip != null && !admin && !isOwner(trip.getUserId(), authenticatedId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        routePointService.deleteByTripId(tripId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRoutePoint(@PathVariable String id, Authentication authentication) {
        routePointService.delete(id);
        return ResponseEntity.noContent().build();
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
