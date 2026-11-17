package com.roomtrail.repository;

import com.roomtrail.entity.RoutePoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoutePointRepository extends JpaRepository<RoutePoint, String> {
    List<RoutePoint> findByTripIdOrderByTimestampAsc(String tripId);
    List<RoutePoint> findByTripIdNotOrderByTimestampAsc(String tripId);
    List<RoutePoint> findByTripIdInOrderByTimestampAsc(List<String> tripIds);

    @Query("SELECT r FROM RoutePoint r WHERE r.tripId = :tripId ORDER BY r.sequenceNumber ASC, r.timestamp ASC, r.id ASC")
    List<RoutePoint> findByTripIdOrderedChronologically(@Param("tripId") String tripId);

    long countByTripId(String tripId);
    void deleteByTripId(String tripId);
    void deleteByTripIdIn(List<String> tripIds);
}

