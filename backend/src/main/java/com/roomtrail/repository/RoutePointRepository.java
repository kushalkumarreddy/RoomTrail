package com.roomtrail.repository;

import com.roomtrail.entity.RoutePoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoutePointRepository extends JpaRepository<RoutePoint, String> {
    List<RoutePoint> findByTripIdOrderByTimestampAsc(String tripId);
    void deleteByTripId(String tripId);
}
