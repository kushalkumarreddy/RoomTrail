package com.roomtrail.service;

import com.roomtrail.dto.AggregatedMetricsDto;
import com.roomtrail.entity.TripSummary;
import com.roomtrail.exception.ResourceNotFoundException;
import com.roomtrail.repository.PropertyRepository;
import com.roomtrail.repository.TripRepository;
import com.roomtrail.repository.TripSummaryRepository;
import com.roomtrail.repository.VisitRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class TripSummaryService {

    private final TripSummaryRepository tripSummaryRepository;
    private final PropertyRepository propertyRepository;
    private final TripRepository tripRepository;
    private final VisitRepository visitRepository;

    public TripSummaryService(TripSummaryRepository tripSummaryRepository,
                              PropertyRepository propertyRepository,
                              TripRepository tripRepository,
                              VisitRepository visitRepository) {
        this.tripSummaryRepository = tripSummaryRepository;
        this.propertyRepository = propertyRepository;
        this.tripRepository = tripRepository;
        this.visitRepository = visitRepository;
    }

    public List<TripSummary> getAll(Long userId) {
        if (userId != null) {
            return tripSummaryRepository.findByUserId(userId);
        }
        return tripSummaryRepository.findAll();
    }

    public TripSummary getById(String id) {
        return tripSummaryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Trip summary not found with id: " + id));
    }

    public Optional<TripSummary> getByTripId(String tripId) {
        return tripSummaryRepository.findByTripId(tripId);
    }

    @Transactional
    public TripSummary create(TripSummary summary, Long userId) {
        if (userId != null) {
            summary.setUserId(userId);
        }
        if (summary.getId() == null || summary.getId().trim().isEmpty()) {
            summary.setId(String.valueOf(System.currentTimeMillis()));
        }
        return tripSummaryRepository.save(summary);
    }

    public AggregatedMetricsDto getAggregatedMetrics(Long userId) {
        AggregatedMetricsDto dto = new AggregatedMetricsDto();
        var properties = userId != null ? propertyRepository.findByUserId(userId) : propertyRepository.findAll();
        var trips = userId != null ? tripRepository.findByUserId(userId) : tripRepository.findAll();
        var visits = userId != null ? visitRepository.findByUserId(userId) : visitRepository.findAll();
        var summaries = userId != null ? tripSummaryRepository.findByUserId(userId) : tripSummaryRepository.findAll();

        long activeCount = trips.stream().filter(t -> "active".equalsIgnoreCase(t.getStatus())).count();
        long completedCount = trips.stream().filter(t -> "completed".equalsIgnoreCase(t.getStatus())).count();
        long totalDistance = summaries.stream().mapToLong(s -> s.getTotalDistanceMeters() != null ? s.getTotalDistanceMeters() : 0).sum();

        dto.setTotalDestinations(properties.size());
        dto.setTotalTrips(trips.size());
        dto.setActiveTripsCount(activeCount);
        dto.setCompletedTripsCount(completedCount);
        dto.setTotalVisits(visits.size());
        dto.setTotalDistanceMeters(totalDistance);
        dto.setRecentDestinations(new ArrayList<>());
        dto.setRecentTrips(new ArrayList<>());

        return dto;
    }
}
