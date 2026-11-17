package com.roomtrail.service;

import com.roomtrail.entity.RoutePoint;
import com.roomtrail.entity.Trip;
import com.roomtrail.repository.RoutePointRepository;
import com.roomtrail.repository.TripRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;

@Service
public class RoutePointService {

    private final RoutePointRepository routePointRepository;
    private final TripRepository tripRepository;

    public RoutePointService(RoutePointRepository routePointRepository, TripRepository tripRepository) {
        this.routePointRepository = routePointRepository;
        this.tripRepository = tripRepository;
    }

    public List<RoutePoint> getAll(String tripId) {
        return getAll(tripId, null);
    }

    public List<RoutePoint> getAll(String tripId, String excludeTripId) {
        if (tripId != null && !tripId.trim().isEmpty()) {
            return routePointRepository.findByTripIdOrderedChronologically(tripId);
        }
        if (excludeTripId != null && !excludeTripId.trim().isEmpty()) {
            return routePointRepository.findByTripIdNotOrderByTimestampAsc(excludeTripId);
        }
        return routePointRepository.findAll();
    }

    public List<RoutePoint> getAllForUser(Long userId, String excludeTripId) {
        if (userId == null) {
            return Collections.emptyList();
        }
        List<Trip> userTrips = tripRepository.findByUserId(userId);
        if (userTrips.isEmpty()) {
            return Collections.emptyList();
        }
        List<String> tripIds = userTrips.stream()
                .map(Trip::getId)
                .filter(id -> excludeTripId == null || !excludeTripId.equals(id))
                .toList();
        if (tripIds.isEmpty()) {
            return Collections.emptyList();
        }
        return routePointRepository.findByTripIdInOrderByTimestampAsc(tripIds);
    }

    @Transactional
    public RoutePoint create(RoutePoint point) {
        if (point.getId() == null || point.getId().trim().isEmpty()) {
            point.setId(String.valueOf(System.currentTimeMillis()));
        }
        if (point.getTripId() != null && (point.getSequenceNumber() == null || point.getSequenceNumber() <= 1)) {
            List<RoutePoint> existing = routePointRepository.findByTripIdOrderByTimestampAsc(point.getTripId());
            point.setSequenceNumber(existing.size() + 1);
        }
        return routePointRepository.save(point);
    }

    @Transactional
    public List<RoutePoint> saveBatch(String tripId, List<RoutePoint> points) {
        if (points == null || points.isEmpty()) {
            return Collections.emptyList();
        }
        for (int i = 0; i < points.size(); i++) {
            RoutePoint p = points.get(i);
            if (p.getTripId() == null || p.getTripId().trim().isEmpty()) {
                p.setTripId(tripId);
            }
            if (p.getId() == null || p.getId().trim().isEmpty()) {
                p.setId("pt_" + tripId + "_" + (p.getSequenceNumber() != null ? p.getSequenceNumber() : (System.currentTimeMillis() + "_" + i)));
            }
            if (p.getSequenceNumber() == null) {
                p.setSequenceNumber(i + 1);
            }
        }
        return routePointRepository.saveAll(points);
    }

    @Transactional
    public void deleteByTripId(String tripId) {
        routePointRepository.deleteByTripId(tripId);
    }

    @Transactional
    public void delete(String id) {
        routePointRepository.deleteById(id);
    }
}
