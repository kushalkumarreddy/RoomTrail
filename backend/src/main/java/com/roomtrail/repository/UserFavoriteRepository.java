package com.roomtrail.repository;

import com.roomtrail.entity.UserFavorite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserFavoriteRepository extends JpaRepository<UserFavorite, Long> {
    List<UserFavorite> findByUserId(Long userId);
    Optional<UserFavorite> findByUserIdAndPropertyId(Long userId, String propertyId);
    boolean existsByUserIdAndPropertyId(Long userId, String propertyId);
    void deleteByUserIdAndPropertyId(Long userId, String propertyId);
    void deleteByUserId(Long userId);
    void deleteByPropertyId(String propertyId);
}
