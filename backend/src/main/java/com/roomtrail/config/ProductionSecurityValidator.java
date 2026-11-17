package com.roomtrail.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Startup security validator for RoomTrail production deployments.
 * Enforces requirement that production must fail safely at startup if required
 * production secrets or database credentials are missing or insecure.
 */
@Component
public class ProductionSecurityValidator {

    private static final Logger log = LoggerFactory.getLogger(ProductionSecurityValidator.class);
    private final Environment environment;

    @Value("${spring.datasource.password:}")
    private String dbPassword;

    @Value("${spring.datasource.url:}")
    private String dbUrl;

    @Value("${roomtrail.jwt.secret:}")
    private String jwtSecret;

    @Value("${roomtrail.cors.allowed-origins:}")
    private String corsAllowedOrigins;

    public ProductionSecurityValidator(Environment environment) {
        this.environment = environment;
    }

    @PostConstruct
    public void validateSecurityConfiguration() {
        boolean isProd = Arrays.stream(environment.getActiveProfiles())
                .anyMatch(p -> p.equalsIgnoreCase("prod") || p.equalsIgnoreCase("production"));

        if (!isProd) {
            log.info("Active profile: [dev/default]. Production security enforcement skipped for local development.");
            return;
        }

        log.info("Active profile: [prod]. Executing production security and credentials validation...");
        List<String> violations = new ArrayList<>();

        // 1. Database URL check
        if (dbUrl == null || dbUrl.trim().isEmpty() || dbUrl.contains("localhost:3306") || dbUrl.contains("127.0.0.1:3306")) {
            violations.add("SPRING_DATASOURCE_URL is missing or referencing local loopback (localhost/127.0.0.1). A production database connection string must be configured.");
        }

        // 2. Database Password check
        if (dbPassword == null || dbPassword.trim().isEmpty()) {
            violations.add("SPRING_DATASOURCE_PASSWORD environment variable is missing. Production database credentials must not be empty.");
        } else if (dbPassword.trim().equalsIgnoreCase("root") || dbPassword.trim().equalsIgnoreCase("password")) {
            violations.add("SPRING_DATASOURCE_PASSWORD is using an insecure default ('root'/'password'). Production requires a strong, unique database password.");
        }

        // 3. JWT Secret check (minimum 256 bits = 32 chars)
        if (jwtSecret == null || jwtSecret.trim().isEmpty()) {
            violations.add("JWT_SECRET environment variable is missing. A cryptographically strong secret must be supplied.");
        } else if (jwtSecret.length() < 32) {
            violations.add("JWT_SECRET is too short (" + jwtSecret.length() + " chars). HMAC-SHA256 requires at least 32 characters (256 bits).");
        } else if (jwtSecret.contains("RoomTrailDevLocalSigningSecretKey") || jwtSecret.contains("RoomTrailSecureJwtSecretKeyForTokenSigning2026FullStackJavaSpringMustBeAtLeast256BitsLong")) {
            violations.add("JWT_SECRET is using a known public template key from source code. A unique, random secret must be configured.");
        }

        // 4. CORS Allowed Origins check
        if (corsAllowedOrigins == null || corsAllowedOrigins.trim().isEmpty()) {
            violations.add("CORS_ALLOWED_ORIGINS environment variable is missing. Production must explicitly configure the deployed frontend origin (e.g. https://roomtrail.app).");
        } else {
            List<String> origins = Arrays.stream(corsAllowedOrigins.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .toList();

            for (String origin : origins) {
                if (origin.equals("*")) {
                    violations.add("CORS_ALLOWED_ORIGINS contains wildcard ('*') which is forbidden when authentication credentials are enabled.");
                } else if (origin.contains("localhost") || origin.contains("127.0.0.1")) {
                    violations.add("CORS_ALLOWED_ORIGINS contains development host ('" + origin + "'). Production permits only the actual deployed frontend origin.");
                }
            }
        }

        // 5. Fail safely if violations exist
        if (!violations.isEmpty()) {
            log.error("==========================================================================");
            log.error("CRITICAL PRODUCTION SECURITY FAILURE - STARTUP ABORTED");
            for (int i = 0; i < violations.size(); i++) {
                log.error("  [{}] {}", i + 1, violations.get(i));
            }
            log.error("==========================================================================");
            throw new IllegalStateException("Production security validation failed with " + violations.size()
                    + " critical violation(s): " + String.join("; ", violations));
        }

        log.info("Production security validation PASSED: Secure database credentials, strong JWT secret, and strict production CORS configured.");
    }
}
