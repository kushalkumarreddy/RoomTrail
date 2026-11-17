package com.roomtrail.service;

import com.roomtrail.dto.TripRouteHistoryDto;
import com.roomtrail.entity.RoutePoint;
import com.roomtrail.entity.Trip;
import com.roomtrail.exception.ResourceNotFoundException;
import com.roomtrail.repository.RoutePointRepository;
import com.roomtrail.repository.TripRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class TripService {

    private final TripRepository tripRepository;
    private final RoutePointRepository routePointRepository;

    public TripService(TripRepository tripRepository, RoutePointRepository routePointRepository) {
        this.tripRepository = tripRepository;
        this.routePointRepository = routePointRepository;
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
        if (userId != null) {
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
        if (updates.containsKey("startLat") && updates.get("startLat") != null) trip.setStartLat(((Number) updates.get("startLat")).doubleValue());
        if (updates.containsKey("startLatitude") && updates.get("startLatitude") != null) trip.setStartLatitude(((Number) updates.get("startLatitude")).doubleValue());
        if (updates.containsKey("startLng") && updates.get("startLng") != null) trip.setStartLng(((Number) updates.get("startLng")).doubleValue());
        if (updates.containsKey("startLongitude") && updates.get("startLongitude") != null) trip.setStartLongitude(((Number) updates.get("startLongitude")).doubleValue());

        if (updates.containsKey("endCoordinates") && updates.get("endCoordinates") instanceof Map<?, ?> ec) {
            if (ec.containsKey("lat") && ec.get("lat") != null) trip.setEndLat(((Number) ec.get("lat")).doubleValue());
            if (ec.containsKey("lng") && ec.get("lng") != null) trip.setEndLng(((Number) ec.get("lng")).doubleValue());
        }
        if (updates.containsKey("endLat") && updates.get("endLat") != null) trip.setEndLat(((Number) updates.get("endLat")).doubleValue());
        if (updates.containsKey("endLatitude") && updates.get("endLatitude") != null) trip.setEndLatitude(((Number) updates.get("endLatitude")).doubleValue());
        if (updates.containsKey("endLng") && updates.get("endLng") != null) trip.setEndLng(((Number) updates.get("endLng")).doubleValue());
        if (updates.containsKey("endLongitude") && updates.get("endLongitude") != null) trip.setEndLongitude(((Number) updates.get("endLongitude")).doubleValue());

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

    public List<TripRouteHistoryDto> getTripRouteHistories(Long userId, String tripId, String startDate, String endDate) {
        List<Trip> trips;
        if (tripId != null && !tripId.trim().isEmpty()) {
            trips = tripRepository.findById(tripId).map(Collections::singletonList).orElseGet(ArrayList::new);
        } else if (userId != null) {
            trips = tripRepository.findByUserId(userId);
        } else {
            trips = tripRepository.findAll();
        }

        List<RoutePoint> allRoutePoints = routePointRepository.findAll();
        Map<String, List<RoutePoint>> pointsByTrip = allRoutePoints.stream()
                .filter(p -> p.getTripId() != null && !p.getTripId().trim().isEmpty())
                .collect(Collectors.groupingBy(RoutePoint::getTripId));

        pointsByTrip.values().forEach(list -> list.sort(Comparator
                .comparing(RoutePoint::getSequenceNumber, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(RoutePoint::getTimestamp, Comparator.nullsLast(Comparator.naturalOrder()))
        ));

        List<TripRouteHistoryDto> results = new ArrayList<>();

        for (Trip trip : trips) {
            String dateStr = trip.getScheduledDate() != null && !trip.getScheduledDate().trim().isEmpty()
                    ? trip.getScheduledDate()
                    : (trip.getStartTime() != null && !trip.getStartTime().trim().isEmpty()
                    ? trip.getStartTime()
                    : (trip.getCreatedAt() != null ? trip.getCreatedAt().toString() : ""));

            String normalizedDate = dateStr.length() >= 10 ? dateStr.substring(0, 10) : dateStr;

            if (startDate != null && !startDate.trim().isEmpty() && normalizedDate.length() >= 10) {
                if (normalizedDate.compareTo(startDate.trim().substring(0, Math.min(10, startDate.trim().length()))) < 0) {
                    continue;
                }
            }

            if (endDate != null && !endDate.trim().isEmpty() && normalizedDate.length() >= 10) {
                if (normalizedDate.compareTo(endDate.trim().substring(0, Math.min(10, endDate.trim().length()))) > 0) {
                    continue;
                }
            }

            TripRouteHistoryDto dto = new TripRouteHistoryDto();
            dto.setTripId(trip.getId());
            dto.setTripName(trip.getTripName() != null ? trip.getTripName() : trip.getTitle());
            dto.setTitle(trip.getTitle());
            dto.setTravelDate(dateStr);
            dto.setStartTime(trip.getStartTime());
            dto.setEndTime(trip.getEndTime());
            dto.setStartLocation(trip.getStartLocation());
            dto.setEndLocation(trip.getEndLocation());
            dto.setStartLat(trip.getStartLat() != null ? trip.getStartLat() : trip.getStartLatitude());
            dto.setStartLng(trip.getStartLng() != null ? trip.getStartLng() : trip.getStartLongitude());
            dto.setEndLat(trip.getEndLat() != null ? trip.getEndLat() : trip.getEndLatitude());
            dto.setEndLng(trip.getEndLng() != null ? trip.getEndLng() : trip.getEndLongitude());
            dto.setTotalDistance(trip.getTotalDistance());
            dto.setTotalDuration(trip.getTotalDuration());
            dto.setTravelMode(trip.getTravelMode());
            dto.setStatus(trip.getStatus());

            List<RoutePoint> tripPoints = pointsByTrip.getOrDefault(trip.getId(), new ArrayList<>());
            dto.setRoutePoints(tripPoints);
            dto.setDestinations(trip.getDestinations());
            dto.setSavedLocationsCount(trip.getDestinations() != null ? trip.getDestinations().size() : 0);

            results.add(dto);
        }

        return results;
    }
}
