package com.roomtrail.controller;

import com.roomtrail.entity.Trip;
import com.roomtrail.security.UserPrincipal;
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

    public TripController(TripService tripService) {
        this.tripService = tripService;
    }

    @GetMapping
    public ResponseEntity<List<Trip>> getAllTrips(@RequestParam(required = false) Long userId,
                                                  @RequestParam(required = false) String status,
                                                  Authentication authentication) {
        Long effectiveUserId = userId != null ? userId : getUserId(authentication);
        return ResponseEntity.ok(tripService.getAll(effectiveUserId, status));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Trip> getTripById(@PathVariable String id) {
        return ResponseEntity.ok(tripService.getById(id));
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
                                          @RequestBody Map<String, Object> updates) {
        return ResponseEntity.ok(tripService.update(id, updates));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Trip> updateTrip(@PathVariable String id,
                                          @RequestBody Map<String, Object> updates) {
        return ResponseEntity.ok(tripService.update(id, updates));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTrip(@PathVariable String id) {
        tripService.delete(id);
        return ResponseEntity.noContent().build();
    }

    private Long getUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal up) {
            return up.getId();
        }
        return null;
    }
}
