package com.roomtrail.repository;

import com.roomtrail.entity.Trip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TripRepository extends JpaRepository<Trip, String> {
    List<Trip> findByUserId(Long userId);
    List<Trip> findByUserIdAndStatus(Long userId, String status);
    Optional<Trip> findByIdAndUserId(String id, Long userId);
}
