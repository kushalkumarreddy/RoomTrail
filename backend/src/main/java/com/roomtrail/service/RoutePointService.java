package com.roomtrail.service;

import com.roomtrail.entity.RoutePoint;
import com.roomtrail.repository.RoutePointRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class RoutePointService {

    private final RoutePointRepository routePointRepository;

    public RoutePointService(RoutePointRepository routePointRepository) {
        this.routePointRepository = routePointRepository;
    }

    public List<RoutePoint> getAll(String tripId) {
        if (tripId != null && !tripId.trim().isEmpty()) {
            return routePointRepository.findByTripIdOrderByTimestampAsc(tripId);
        }
        return routePointRepository.findAll();
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
    public void deleteByTripId(String tripId) {
        routePointRepository.deleteByTripId(tripId);
    }

    @Transactional
    public void delete(String id) {
        routePointRepository.deleteById(id);
    }
}
