package com.roomtrail.controller;

import com.roomtrail.entity.RoutePoint;
import com.roomtrail.service.RoutePointService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/routePoints", "/api/route-points"})
public class RoutePointController {

    private final RoutePointService routePointService;

    public RoutePointController(RoutePointService routePointService) {
        this.routePointService = routePointService;
    }

    @GetMapping
    public ResponseEntity<List<RoutePoint>> getRoutePoints(@RequestParam(required = false) String tripId) {
        return ResponseEntity.ok(routePointService.getAll(tripId));
    }

    @PostMapping
    public ResponseEntity<RoutePoint> createRoutePoint(@RequestBody RoutePoint point) {
        RoutePoint created = routePointService.create(point);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @DeleteMapping("/trip/{tripId}")
    public ResponseEntity<Void> deleteByTripId(@PathVariable String tripId) {
        routePointService.deleteByTripId(tripId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRoutePoint(@PathVariable String id) {
        routePointService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
