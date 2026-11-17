package com.roomtrail.repository;

import com.roomtrail.entity.RoomInspection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomInspectionRepository extends JpaRepository<RoomInspection, Long> {

    List<RoomInspection> findByPropertyIdAndUserIdOrderByInspectionDateDescCreatedAtDesc(String propertyId, Long userId);

    Optional<RoomInspection> findByIdAndUserId(Long id, Long userId);

    Optional<RoomInspection> findFirstByPropertyIdAndUserIdOrderByInspectionDateDescCreatedAtDesc(String propertyId, Long userId);

    long countByPropertyIdAndUserId(String propertyId, Long userId);

    void deleteByIdAndUserId(Long id, Long userId);
}
