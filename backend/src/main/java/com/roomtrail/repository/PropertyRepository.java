package com.roomtrail.repository;

import com.roomtrail.entity.Property;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PropertyRepository extends JpaRepository<Property, String> {
    List<Property> findByUserId(Long userId);
    List<Property> findByUserIdAndIsFavorite(Long userId, Boolean isFavorite);
    Optional<Property> findByIdAndUserId(String id, Long userId);
    long countByUserId(Long userId);
    long countByUserIdAndIsFavorite(Long userId, Boolean isFavorite);
    void deleteByUserId(Long userId);

    @Query("SELECT p.category, COUNT(p) FROM Property p GROUP BY p.category")
    List<Object[]> countGroupByCategory();
}
