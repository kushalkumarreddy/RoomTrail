package com.roomtrail.repository;

import com.roomtrail.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByUsername(String username);
    Boolean existsByEmail(String email);
    Boolean existsByUsername(String username);

    long countByStatus(String status);

    @Query("SELECT COUNT(u) FROM User u WHERE (u.role = 'ADMIN' OR u.role = 'ROLE_ADMIN') AND (u.status = 'ACTIVE' OR u.status IS NULL)")
    long countActiveAdmins();
}
