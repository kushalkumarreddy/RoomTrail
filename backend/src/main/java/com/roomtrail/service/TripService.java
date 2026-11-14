package com.roomtrail.service;

import com.roomtrail.entity.Trip;
import com.roomtrail.exception.ResourceNotFoundException;
import com.roomtrail.repository.TripRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
public class TripService {

    private final TripRepository tripRepository;

    public TripService(TripRepository tripRepository) {
        this.tripRepository = tripRepository;
    }

    public List<Trip> getAll(Long userId, String status) {
        if (userId != null && status != null && !status.trim().isEmpty()) {
            return tripRepository.findByUserIdAndStatus(userId, status);
        } else if (userId != null) {
            return tripRepository.findByUserId(userId);
        }
        return tripRepository.findAll();
    }

    public Trip getById(String id) {
        return tripRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Trip not found with id: " + id));
    }

    @Transactional
    public Trip create(Trip trip, Long userId) {
        if (userId != null && trip.getUserId() == null) {
            trip.setUserId(userId);
        }
        if (trip.getId() == null || trip.getId().trim().isEmpty()) {
            trip.setId(String.valueOf(System.currentTimeMillis()));
        }
        if (trip.getTitle() == null && trip.getTripName() != null) {
            trip.setTitle(trip.getTripName());
        } else if (trip.getTripName() == null && trip.getTitle() != null) {
            trip.setTripName(trip.getTitle());
        }
        return tripRepository.save(trip);
    }

    @Transactional
    public Trip update(String id, Map<String, Object> updates) {
        Trip trip = getById(id);

        if (updates.containsKey("tripName")) trip.setTripName((String) updates.get("tripName"));
        if (updates.containsKey("title")) trip.setTitle((String) updates.get("title"));
        if (updates.containsKey("description")) trip.setDescription((String) updates.get("description"));
        if (updates.containsKey("startLocation")) trip.setStartLocation((String) updates.get("startLocation"));
        if (updates.containsKey("endLocation")) trip.setEndLocation((String) updates.get("endLocation"));

        if (updates.containsKey("startCoordinates") && updates.get("startCoordinates") instanceof Map<?, ?> sc) {
            if (sc.containsKey("lat") && sc.get("lat") != null) trip.setStartLat(((Number) sc.get("lat")).doubleValue());
            if (sc.containsKey("lng") && sc.get("lng") != null) trip.setStartLng(((Number) sc.get("lng")).doubleValue());
        }
        if (updates.containsKey("endCoordinates") && updates.get("endCoordinates") instanceof Map<?, ?> ec) {
            if (ec.containsKey("lat") && ec.get("lat") != null) trip.setEndLat(((Number) ec.get("lat")).doubleValue());
            if (ec.containsKey("lng") && ec.get("lng") != null) trip.setEndLng(((Number) ec.get("lng")).doubleValue());
        }

        if (updates.containsKey("status")) trip.setStatus((String) updates.get("status"));
        if (updates.containsKey("totalDistance")) trip.setTotalDistance((String) updates.get("totalDistance"));
        if (updates.containsKey("totalDuration")) trip.setTotalDuration((String) updates.get("totalDuration"));
        if (updates.containsKey("travelMode")) trip.setTravelMode((String) updates.get("travelMode"));
        if (updates.containsKey("endTime")) trip.setEndTime((String) updates.get("endTime"));
        if (updates.containsKey("startTime")) trip.setStartTime((String) updates.get("startTime"));
        if (updates.containsKey("scheduledDate")) trip.setScheduledDate((String) updates.get("scheduledDate"));

        if (updates.containsKey("destinations")) {
            Object dests = updates.get("destinations");
            trip.setDestinationsJson(dests != null ? dests.toString() : null);
        }

        return tripRepository.save(trip);
    }

    @Transactional
    public void delete(String id) {
        Trip trip = getById(id);
        tripRepository.delete(trip);
    }
}
