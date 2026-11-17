package com.roomtrail.service;

import com.roomtrail.dto.TripRouteHistoryDto;
import com.roomtrail.dto.TripTimelineDto;
import com.roomtrail.dto.TripTimelineStopDto;
import com.roomtrail.entity.Property;
import com.roomtrail.entity.RoutePoint;
import com.roomtrail.entity.Trip;
import com.roomtrail.entity.Visit;
import com.roomtrail.exception.ResourceNotFoundException;
import com.roomtrail.repository.PropertyRepository;
import com.roomtrail.repository.RoutePointRepository;
import com.roomtrail.repository.TripRepository;
import com.roomtrail.repository.TripSummaryRepository;
import com.roomtrail.repository.VisitRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TripService {

    private final TripRepository tripRepository;
    private final RoutePointRepository routePointRepository;
    private final VisitRepository visitRepository;
    private final PropertyRepository propertyRepository;
    private final TripSummaryRepository tripSummaryRepository;

    public TripService(TripRepository tripRepository,
                       RoutePointRepository routePointRepository,
                       VisitRepository visitRepository,
                       PropertyRepository propertyRepository,
                       TripSummaryRepository tripSummaryRepository) {
        this.tripRepository = tripRepository;
        this.routePointRepository = routePointRepository;
        this.visitRepository = visitRepository;
        this.propertyRepository = propertyRepository;
        this.tripSummaryRepository = tripSummaryRepository;
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
        deleteTripWithRelated(id, null);
    }

    @Transactional
    public void deleteTripWithRelated(String tripId, Long userId) {
        Trip trip = getById(tripId);
        if (trip == null) {
            throw new ResourceNotFoundException("Trip not found with id: " + tripId);
        }

        // Strict ownership check if userId is provided
        if (userId != null && trip.getUserId() != null) {
            try {
                if (Long.parseLong(trip.getUserId().trim()) != userId) {
                    throw new org.springframework.security.access.AccessDeniedException("You do not have permission to delete this trip");
                }
            } catch (NumberFormatException e) {
                if (!trip.getUserId().trim().equalsIgnoreCase(String.valueOf(userId))) {
                    throw new org.springframework.security.access.AccessDeniedException("You do not have permission to delete this trip");
                }
            }
        }

        // 1. Transactionally remove associated route points (breadcrumbs)
        routePointRepository.deleteByTripId(tripId);

        // 2. Transactionally remove trip summary if exists
        tripSummaryRepository.deleteByTripId(tripId);

        // 3. Transactionally remove trip stops/visits without modifying saved rooms (properties table)
        visitRepository.deleteByTripId(tripId);

        // 4. Delete the trip itself
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

    /**
     * Build chronological Trip Timeline (Phase 4)
     * Strictly scopes all visits and personal notes to the authenticated user.
     */
    public TripTimelineDto getTripTimeline(String tripId, Long userId) {
        Trip trip = getById(tripId);
        if (trip == null) {
            return null;
        }

        // Fetch stops (visits) for this trip strictly scoped by userId
        List<Visit> rawVisits;
        if (userId != null) {
            rawVisits = visitRepository.findByTripIdAndUserId(tripId, userId);
        } else {
            rawVisits = visitRepository.findByTripId(tripId);
        }

        // Fetch user's saved properties for name, address and notes enrichment
        Map<String, Property> propertyMap = new HashMap<>();
        if (userId != null) {
            List<Property> props = propertyRepository.findByUserId(userId);
            for (Property p : props) {
                if (p.getId() != null) propertyMap.put(p.getId(), p);
            }
        }

        // Sort visits chronologically
        List<Visit> sortedVisits = new ArrayList<>(rawVisits);
        sortedVisits.sort((a, b) -> {
            String timeA = a.getArrivalTime() != null ? a.getArrivalTime() : a.getVisitedAt();
            String timeB = b.getArrivalTime() != null ? b.getArrivalTime() : b.getVisitedAt();
            if (timeA != null && timeB != null) {
                int cmp = timeA.compareTo(timeB);
                if (cmp != 0) return cmp;
            } else if (timeA != null) {
                return -1;
            } else if (timeB != null) {
                return 1;
            }
            if (a.getCreatedAt() != null && b.getCreatedAt() != null) {
                return a.getCreatedAt().compareTo(b.getCreatedAt());
            }
            return String.valueOf(a.getId()).compareTo(String.valueOf(b.getId()));
        });

        boolean isTripActive = trip.getStatus() != null && trip.getStatus().equalsIgnoreCase("active");

        List<TripTimelineStopDto> stopDtos = new ArrayList<>();
        for (int i = 0; i < sortedVisits.size(); i++) {
            Visit v = sortedVisits.get(i);
            TripTimelineStopDto stop = new TripTimelineStopDto();
            stop.setId(v.getId());
            stop.setStopNumber(i + 1);

            String propId = v.getPropertyId() != null ? v.getPropertyId() : v.getDestinationId();
            stop.setPropertyId(propId);
            Property prop = (propId != null) ? propertyMap.get(propId) : null;

            // Location Name
            if (v.getPropertyName() != null && !v.getPropertyName().isBlank()) {
                stop.setLocationName(v.getPropertyName().trim());
            } else if (prop != null && prop.getName() != null && !prop.getName().isBlank()) {
                stop.setLocationName(prop.getName().trim());
            } else {
                stop.setLocationName("Stop #" + (i + 1));
            }

            // Category
            if (v.getCategory() != null && !v.getCategory().isBlank()) {
                stop.setCategory(v.getCategory().toLowerCase());
            } else if (prop != null && prop.getCategory() != null && !prop.getCategory().isBlank()) {
                stop.setCategory(prop.getCategory().toLowerCase());
            } else {
                stop.setCategory("room");
            }

            // Address
            if (v.getAddress() != null && !v.getAddress().isBlank()) {
                stop.setAddress(v.getAddress().trim());
            } else if (prop != null && prop.getAddress() != null && !prop.getAddress().isBlank()) {
                String fullAddr = prop.getAddress().trim();
                if (prop.getCity() != null && !prop.getCity().isBlank() && !fullAddr.contains(prop.getCity())) {
                    fullAddr += ", " + prop.getCity().trim();
                }
                stop.setAddress(fullAddr);
            } else if (v.getLatitude() != null && v.getLongitude() != null) {
                stop.setAddress(String.format("%.4f°, %.4f°", v.getLatitude(), v.getLongitude()));
            } else {
                stop.setAddress("Address not specified");
            }

            // Coordinates
            Double lat = v.getLatitude() != null ? v.getLatitude() : (v.getVisitLat() != null ? v.getVisitLat() : (prop != null ? prop.getLatitude() : null));
            Double lng = v.getLongitude() != null ? v.getLongitude() : (v.getVisitLng() != null ? v.getVisitLng() : (prop != null ? prop.getLongitude() : null));
            stop.setLatitude(lat);
            stop.setLongitude(lng);
            stop.setIsRevisit(Boolean.TRUE.equals(v.getIsRevisit()));

            // Personal Notes (strictly owned by authenticated user)
            if (v.getNotes() != null && !v.getNotes().isBlank()) {
                stop.setNotes(v.getNotes().trim());
            } else if (prop != null && prop.getNotes() != null && !prop.getNotes().isBlank()) {
                stop.setNotes(prop.getNotes().trim());
            } else {
                stop.setNotes(null);
            }

            // Timestamps
            String arrival = v.getArrivalTime() != null ? v.getArrivalTime() : v.getVisitedAt();
            String departure = v.getDepartureTime();
            stop.setArrivalTime(arrival);
            stop.setDepartureTime(departure);

            stop.setArrivalTimeFormatted(formatDisplayDateTime(arrival));

            // Check if active stop: isTripActive AND latest stop AND departure is null/blank
            boolean isCurrentActive = isTripActive && (i == sortedVisits.size() - 1) && (departure == null || departure.isBlank());
            stop.setIsActiveStop(isCurrentActive);

            if (isCurrentActive) {
                stop.setDepartureTimeFormatted("Currently at this location");
                stop.setDuration("Currently at this location");
                stop.setDurationMinutes(null);
            } else if (departure != null && !departure.isBlank()) {
                stop.setDepartureTimeFormatted(formatDisplayDateTime(departure));
                Long durationMins = calculateDurationMinutes(arrival, departure);
                stop.setDurationMinutes(durationMins);
                stop.setDuration(formatDuration(durationMins));
            } else {
                stop.setDepartureTimeFormatted("Departure not recorded");
                stop.setDuration("Duration not recorded");
                stop.setDurationMinutes(null);
            }

            stopDtos.add(stop);
        }

        TripTimelineDto timeline = new TripTimelineDto();
        timeline.setTripId(trip.getId());
        timeline.setTripName(trip.getTripName() != null ? trip.getTripName() : trip.getTitle());
        timeline.setTitle(trip.getTitle());
        timeline.setStatus(trip.getStatus());
        timeline.setStartTime(trip.getStartTime());
        timeline.setStartTimeFormatted(formatDisplayDateTime(trip.getStartTime()));
        timeline.setEndTime(trip.getEndTime());
        timeline.setEndTimeFormatted(isTripActive ? "In Progress" : formatDisplayDateTime(trip.getEndTime()));
        timeline.setStartLocation(trip.getStartLocation() != null ? trip.getStartLocation() : "Trip Origin");
        timeline.setEndLocation(trip.getEndLocation() != null ? trip.getEndLocation() : "Trip Destination");
        timeline.setStartLat(trip.getStartLat() != null ? trip.getStartLat() : trip.getStartLatitude());
        timeline.setStartLng(trip.getStartLng() != null ? trip.getStartLng() : trip.getStartLongitude());
        timeline.setEndLat(trip.getEndLat() != null ? trip.getEndLat() : trip.getEndLatitude());
        timeline.setEndLng(trip.getEndLng() != null ? trip.getEndLng() : trip.getEndLongitude());
        timeline.setTotalDistance(trip.getTotalDistance() != null ? trip.getTotalDistance() : "0 km");
        timeline.setTotalDuration(trip.getTotalDuration() != null ? trip.getTotalDuration() : "0 mins");
        timeline.setTotalStopsCount(stopDtos.size());
        timeline.setStops(stopDtos);

        long ptCount = routePointRepository.countByTripId(trip.getId());
        timeline.setHasRoutePoints(ptCount > 0);
        timeline.setRoutePointsCount((int) ptCount);

        return timeline;
    }

    private LocalDateTime parseDateTime(String raw) {
        if (raw == null || raw.trim().isEmpty()) return null;
        String s = raw.trim();
        try {
            if (s.contains("T")) {
                if (s.endsWith("Z")) {
                    Instant instant = Instant.parse(s);
                    return LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
                } else {
                    int len = Math.min(19, s.length());
                    return LocalDateTime.parse(s.substring(0, len), DateTimeFormatter.ISO_LOCAL_DATE_TIME);
                }
            } else if (s.contains(" ")) {
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm[:ss]");
                int len = Math.min(19, s.length());
                return LocalDateTime.parse(s.substring(0, len), formatter);
            } else if (s.contains(":")) {
                LocalTime time = LocalTime.parse(s.length() == 5 ? s + ":00" : s);
                return LocalDateTime.of(LocalDate.now(), time);
            } else if (s.matches("^\\d{4}-\\d{2}-\\d{2}$")) {
                LocalDate date = LocalDate.parse(s);
                return date.atStartOfDay();
            }
        } catch (Exception ignored) {}
        return null;
    }

    private Long calculateDurationMinutes(String arrivalRaw, String departureRaw) {
        if (arrivalRaw == null || departureRaw == null) return null;
        LocalDateTime arrival = parseDateTime(arrivalRaw);
        LocalDateTime departure = parseDateTime(departureRaw);
        if (arrival == null || departure == null) return null;

        long diffMinutes = Duration.between(arrival, departure).toMinutes();
        if (diffMinutes < 0) {
            // Handled stops crossing midnight (e.g. arrival 23:45, departure 00:30 next day)
            diffMinutes += 24 * 60;
        }
        return Math.max(0, diffMinutes);
    }

    private String formatDuration(Long minutes) {
        if (minutes == null) return "Duration not recorded";
        if (minutes == 0) return "0 mins";
        if (minutes < 60) return minutes + " mins";
        long hrs = minutes / 60;
        long remMins = minutes % 60;
        if (remMins == 0) {
            return hrs == 1 ? "1 hr" : hrs + " hrs";
        }
        return (hrs == 1 ? "1 hr " : hrs + " hrs ") + remMins + " mins";
    }

    private String formatDisplayDateTime(String raw) {
        if (raw == null || raw.trim().isEmpty()) return "Not recorded";
        LocalDateTime dt = parseDateTime(raw);
        if (dt == null) return raw;
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MMM dd, yyyy, hh:mm a");
        return dt.format(fmt);
    }
}
