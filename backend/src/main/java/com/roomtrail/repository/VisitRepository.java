package com.roomtrail.repository;

import com.roomtrail.entity.Visit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VisitRepository extends JpaRepository<Visit, String> {
    List<Visit> findByUserId(Long userId);
    List<Visit> findByTripId(String tripId);
    List<Visit> findByDestinationId(String destinationId);
    long countByUserId(Long userId);
    void deleteByUserId(Long userId);
}
