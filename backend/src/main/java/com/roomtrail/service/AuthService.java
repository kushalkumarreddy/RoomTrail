package com.roomtrail.service;

import com.roomtrail.dto.AuthRequest;
import com.roomtrail.dto.AuthResponse;
import com.roomtrail.dto.RegisterRequest;
import com.roomtrail.dto.UserProfileDto;
import com.roomtrail.entity.User;
import com.roomtrail.exception.BadRequestException;
import com.roomtrail.repository.UserRepository;
import com.roomtrail.security.JwtTokenProvider;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager,
                       JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.tokenProvider = tokenProvider;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("An account with this email address already exists.");
        }
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BadRequestException("This username is already taken. Please choose another.");
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setFullName(request.getFullName() != null ? request.getFullName() : request.getUsername());
        user.setPhone(request.getPhone());
        user.setCity(request.getCity());
        user.setTravelMode(request.getTravelMode());
        user.setRole("ROLE_USER");

        User savedUser = userRepository.save(user);

        String token = tokenProvider.generateTokenFromUsername(savedUser.getUsername(), savedUser.getId(), savedUser.getEmail());
        return new AuthResponse(token, UserProfileDto.fromEntity(savedUser));
    }

    public AuthResponse login(AuthRequest request) {
        String identifier = request.getIdentifier();
        if (identifier == null || identifier.trim().isEmpty() || request.getPassword() == null || request.getPassword().trim().isEmpty()) {
            throw new BadRequestException("Username and password are required.");
        }

        // Authenticate with Spring Security using either username or email
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(identifier.trim(), request.getPassword())
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);

        User user = userRepository.findByUsername(identifier.trim())
                .or(() -> userRepository.findByEmail(identifier.trim()))
                .orElseThrow(() -> new BadRequestException("Invalid credentials"));

        String token = tokenProvider.generateToken(authentication);
        return new AuthResponse(token, UserProfileDto.fromEntity(user));
    }

    public UserProfileDto getCurrentUser(String username) {
        User user = userRepository.findByUsername(username)
                .or(() -> userRepository.findByEmail(username))
                .orElseThrow(() -> new BadRequestException("User session not found"));
        return UserProfileDto.fromEntity(user);
    }
}
