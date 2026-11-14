package com.roomtrail.repository;

import com.roomtrail.entity.TripSummary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TripSummaryRepository extends JpaRepository<TripSummary, String> {
    List<TripSummary> findByUserId(Long userId);
    Optional<TripSummary> findByTripId(String tripId);
}
