package com.roomtrail;

import com.roomtrail.entity.User;
import com.roomtrail.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class RoomTrailApplicationTests {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void contextLoads() {
        assertNotNull(userRepository);
        assertNotNull(passwordEncoder);
    }

    @Test
    void testPasswordEncoderAndDefaultUser() {
        String rawPassword = "password123";
        String encoded = passwordEncoder.encode(rawPassword);
        assertTrue(passwordEncoder.matches(rawPassword, encoded));

        userRepository.findByEmail("alex@roomtrail.com").ifPresent(user -> {
            assertTrue(passwordEncoder.matches(rawPassword, user.getPassword()));
            assertEquals("alex_traveler", user.getUsername());
        });
    }
}
