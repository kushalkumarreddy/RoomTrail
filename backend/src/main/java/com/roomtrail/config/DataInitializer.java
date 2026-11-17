package com.roomtrail.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.roomtrail.entity.*;
import com.roomtrail.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final UserRepository userRepository;
    private final PropertyRepository propertyRepository;
    private final TripRepository tripRepository;
    private final VisitRepository visitRepository;
    private final RoutePointRepository routePointRepository;
    private final TripSummaryRepository tripSummaryRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;

    public DataInitializer(UserRepository userRepository,
                           PropertyRepository propertyRepository,
                           TripRepository tripRepository,
                           VisitRepository visitRepository,
                           RoutePointRepository routePointRepository,
                           TripSummaryRepository tripSummaryRepository,
                           PasswordEncoder passwordEncoder,
                           ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.propertyRepository = propertyRepository;
        this.tripRepository = tripRepository;
        this.visitRepository = visitRepository;
        this.routePointRepository = routePointRepository;
        this.tripSummaryRepository = tripSummaryRepository;
        this.passwordEncoder = passwordEncoder;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Starting RoomTrail Data Migration and Seeding...");

        try {
            // 1. Check if default admin account exists, if not initialize automatically
            if (!userRepository.existsByUsername("admink") && !userRepository.existsByEmail("admink@roomtrail.com")) {
                User adminUser = new User();
                adminUser.setUsername("admink");
                adminUser.setEmail("admink@roomtrail.com");
                adminUser.setPassword(passwordEncoder.encode("admink"));
                adminUser.setFullName("Administrator");
                adminUser.setPhone("+91 99999 88888");
                adminUser.setRole("ROLE_ADMIN");
                adminUser.setBio("System Administrator for RoomTrail platform");
                adminUser.setTravelMode("car");
                adminUser.setCity("Bengaluru, India");
                adminUser.setHomeLat(12.9716);
                adminUser.setHomeLng(77.5946);
                adminUser.setNotificationRadiusMeters(200);
                adminUser.setThemePreference("light");
                userRepository.save(adminUser);
                log.info("Initialized default admin account: admink / admink (Role: ADMIN) with BCrypt hashed password.");
            } else {
                // Ensure existing admink account has ROLE_ADMIN and BCrypt hashed password
                userRepository.findByUsername("admink").or(() -> userRepository.findByEmail("admink@roomtrail.com")).ifPresent(admin -> {
                    boolean changed = false;
                    if (!"ROLE_ADMIN".equalsIgnoreCase(admin.getRole()) && !"ADMIN".equalsIgnoreCase(admin.getRole())) {
                        admin.setRole("ROLE_ADMIN");
                        changed = true;
                    }
                    if (!passwordEncoder.matches("admink", admin.getPassword())) {
                        admin.setPassword(passwordEncoder.encode("admink"));
                        changed = true;
                    }
                    if (changed) {
                        userRepository.save(admin);
                        log.info("Refreshed default admin account admink credentials and role.");
                    }
                });
            }

            // 2. Check if default user exists, if not seed
            if (!userRepository.existsByEmail("alex@roomtrail.com") && !userRepository.existsByUsername("alex_traveler")) {
                User defaultUser = new User();
                defaultUser.setId(1L);
                defaultUser.setUsername("alex_traveler");
                defaultUser.setEmail("alex@roomtrail.com");
                defaultUser.setPassword(passwordEncoder.encode("password123"));
                defaultUser.setFullName("Alex Morgan");
                defaultUser.setPhone("+91 98765 43210");
                defaultUser.setRole("ROLE_USER");
                defaultUser.setBio("Hunting for rental 2BHK flats in Indiranagar and tracking daily routes.");
                defaultUser.setTravelMode("car");
                defaultUser.setCity("Bengaluru, India");
                defaultUser.setHomeLat(12.9716);
                defaultUser.setHomeLng(77.5946);
                defaultUser.setNotificationRadiusMeters(200);
                defaultUser.setThemePreference("light");
                userRepository.save(defaultUser);
                log.info("Seeded default user alex@roomtrail.com with BCrypt hashed password.");
            }

            // Attempt to load db.json for comprehensive historical data migration
            Path dbJsonPath = findDbJsonPath();
            if (dbJsonPath != null && Files.exists(dbJsonPath)) {
                log.info("Found db.json at {}, performing migration to MySQL...", dbJsonPath);
                String content = Files.readString(dbJsonPath);
                JsonNode root = objectMapper.readTree(content);

                // 1. Properties Migration
                if (root.has("properties") && propertyRepository.count() == 0) {
                    JsonNode propsNode = root.get("properties");
                    for (JsonNode pNode : propsNode) {
                        Property p = new Property();
                        p.setId(pNode.has("id") ? pNode.get("id").asText() : String.valueOf(System.currentTimeMillis()));
                        p.setUserId(1L);
                        p.setName(pNode.has("name") ? pNode.get("name").asText() : "Unnamed Destination");
                        p.setCategory(pNode.has("category") ? pNode.get("category").asText() : "flat");
                        p.setAddress(pNode.has("address") ? pNode.get("address").asText() : "");
                        p.setCity(pNode.has("city") ? pNode.get("city").asText() : "Bengaluru");
                        p.setLatitude(pNode.has("latitude") ? pNode.get("latitude").asDouble() : null);
                        p.setLongitude(pNode.has("longitude") ? pNode.get("longitude").asDouble() : null);
                        p.setDescription(pNode.has("description") ? pNode.get("description").asText() : "");
                        p.setPriority(pNode.has("priority") ? pNode.get("priority").asText() : "medium");
                        p.setRent(pNode.has("rent") ? pNode.get("rent").asText() : (pNode.has("price") ? pNode.get("price").asText() : ""));
                        p.setPrice(pNode.has("price") ? pNode.get("price").asText() : p.getRent());
                        p.setContactPerson(pNode.has("contactPerson") ? pNode.get("contactPerson").asText() : "");
                        p.setContactPhone(pNode.has("contactPhone") ? pNode.get("contactPhone").asText() : "");
                        p.setContactDetails(pNode.has("contactDetails") ? pNode.get("contactDetails").asText() : "");
                        p.setNotes(pNode.has("notes") ? pNode.get("notes").asText() : "");
                        p.setVisited(pNode.has("visited") && pNode.get("visited").asBoolean());
                        p.setVisitStatus(pNode.has("visitStatus") ? pNode.get("visitStatus").asText() : (p.getVisited() ? "visited" : "pending"));
                        p.setVisitedAt(pNode.has("visitedAt") ? pNode.get("visitedAt").asText() : null);
                        if (pNode.has("amenities") || pNode.has("facilities")) {
                            JsonNode amNode = pNode.has("amenities") ? pNode.get("amenities") : pNode.get("facilities");
                            java.util.List<String> amList = new java.util.ArrayList<>();
                            if (amNode.isArray()) {
                                for (JsonNode item : amNode) {
                                    amList.add(item.asText());
                                }
                            } else {
                                amList.add(amNode.asText());
                            }
                            p.setAmenities(amList);
                        }
                        propertyRepository.save(p);
                    }
                    log.info("Migrated {} properties from db.json to MySQL.", propsNode.size());
                }

                // 2. Trips Migration
                if (root.has("trips") && tripRepository.count() == 0) {
                    JsonNode tripsNode = root.get("trips");
                    for (JsonNode tNode : tripsNode) {
                        Trip t = new Trip();
                        t.setId(tNode.has("id") ? tNode.get("id").asText() : String.valueOf(System.currentTimeMillis()));
                        t.setUserId(1L);
                        t.setTripName(tNode.has("tripName") ? tNode.get("tripName").asText() : (tNode.has("title") ? tNode.get("title").asText() : "Trip"));
                        t.setTitle(t.getTripName());
                        t.setDescription(tNode.has("description") ? tNode.get("description").asText() : "");
                        t.setStartLocation(tNode.has("startLocation") ? tNode.get("startLocation").asText() : "Home Base");
                        if (tNode.has("startCoordinates")) {
                            JsonNode sc = tNode.get("startCoordinates");
                            if (sc.has("lat")) t.setStartLat(sc.get("lat").asDouble());
                            if (sc.has("lng")) t.setStartLng(sc.get("lng").asDouble());
                        }
                        t.setEndLocation(tNode.has("endLocation") ? tNode.get("endLocation").asText() : "Final Stop");
                        if (tNode.has("endCoordinates")) {
                            JsonNode ec = tNode.get("endCoordinates");
                            if (ec.has("lat")) t.setEndLat(ec.get("lat").asDouble());
                            if (ec.has("lng")) t.setEndLng(ec.get("lng").asDouble());
                        }
                        t.setStartTime(tNode.has("startTime") ? tNode.get("startTime").asText() : null);
                        t.setScheduledDate(tNode.has("scheduledDate") ? tNode.get("scheduledDate").asText() : null);
                        t.setEndTime(tNode.has("endTime") ? tNode.get("endTime").asText() : null);
                        t.setStatus(tNode.has("status") ? tNode.get("status").asText() : "completed");
                        t.setTotalDistance(tNode.has("totalDistance") ? tNode.get("totalDistance").asText() : "0 km");
                        t.setTotalDuration(tNode.has("totalDuration") ? tNode.get("totalDuration").asText() : "0 mins");
                        t.setTravelMode(tNode.has("travelMode") ? tNode.get("travelMode").asText() : "car");
                        if (tNode.has("destinations")) {
                            t.setDestinationsJson(tNode.get("destinations").toString());
                        }
                        tripRepository.save(t);
                    }
                    log.info("Migrated {} trips from db.json to MySQL.", tripsNode.size());
                }

                // 3. Visits Migration
                if (root.has("visits") && visitRepository.count() == 0) {
                    JsonNode visitsNode = root.get("visits");
                    for (JsonNode vNode : visitsNode) {
                        Visit v = new Visit();
                        v.setId(vNode.has("id") ? vNode.get("id").asText() : String.valueOf(System.currentTimeMillis()));
                        v.setUserId(1L);
                        v.setTripId(vNode.has("tripId") ? vNode.get("tripId").asText() : null);
                        v.setDestinationId(vNode.has("destinationId") ? vNode.get("destinationId").asText() : (vNode.has("propertyId") ? vNode.get("propertyId").asText() : null));
                        v.setPropertyId(v.getDestinationId());
                        v.setPropertyName(vNode.has("propertyName") ? vNode.get("propertyName").asText() : "Destination");
                        v.setCategory(vNode.has("category") ? vNode.get("category").asText() : "flat");
                        v.setAddress(vNode.has("address") ? vNode.get("address").asText() : "");
                        v.setArrivalTime(vNode.has("arrivalTime") ? vNode.get("arrivalTime").asText() : (vNode.has("visitedAt") ? vNode.get("visitedAt").asText() : null));
                        v.setVisitedAt(v.getArrivalTime());
                        v.setVisitStatus(vNode.has("visitStatus") ? vNode.get("visitStatus").asText() : "confirmed");
                        v.setStatus(vNode.has("status") ? vNode.get("status").asText() : "confirmed");
                        v.setNotes(vNode.has("notes") ? vNode.get("notes").asText() : "");
                        v.setIsRevisit(vNode.has("isRevisit") && vNode.get("isRevisit").asBoolean());
                        if (vNode.has("visitCoordinates")) {
                            JsonNode vc = vNode.get("visitCoordinates");
                            if (vc.has("lat")) v.setVisitLat(vc.get("lat").asDouble());
                            if (vc.has("lng")) v.setVisitLng(vc.get("lng").asDouble());
                        }
                        visitRepository.save(v);
                    }
                    log.info("Migrated {} visits from db.json to MySQL.", visitsNode.size());
                }

                // 4. RoutePoints Migration
                if (root.has("routePoints") && routePointRepository.count() == 0) {
                    JsonNode pointsNode = root.get("routePoints");
                    for (JsonNode ptNode : pointsNode) {
                        RoutePoint pt = new RoutePoint();
                        pt.setId(ptNode.has("id") ? ptNode.get("id").asText() : String.valueOf(System.currentTimeMillis()));
                        pt.setTripId(ptNode.has("tripId") ? ptNode.get("tripId").asText() : "BEo8OVDzY50");
                        pt.setLatitude(ptNode.has("latitude") ? ptNode.get("latitude").asDouble() : 12.9716);
                        pt.setLongitude(ptNode.has("longitude") ? ptNode.get("longitude").asDouble() : 77.5946);
                        pt.setAccuracy(ptNode.has("accuracy") ? ptNode.get("accuracy").asInt() : 6);
                        pt.setSpeed(ptNode.has("speed") ? ptNode.get("speed").asDouble() : 0.0);
                        pt.setTimestamp(ptNode.has("timestamp") ? ptNode.get("timestamp").asText() : null);
                        routePointRepository.save(pt);
                    }
                    log.info("Migrated {} route points from db.json to MySQL.", pointsNode.size());
                }

                // 5. TripSummaries Migration
                if (root.has("tripSummaries") && tripSummaryRepository.count() == 0) {
                    JsonNode sumNode = root.get("tripSummaries");
                    for (JsonNode sNode : sumNode) {
                        TripSummary s = new TripSummary();
                        s.setId(sNode.has("id") ? sNode.get("id").asText() : String.valueOf(System.currentTimeMillis()));
                        s.setTripId(sNode.has("tripId") ? sNode.get("tripId").asText() : "BEo8OVDzY50");
                        s.setUserId(1L);
                        s.setTripTitle(sNode.has("tripTitle") ? sNode.get("tripTitle").asText() : "Trip Summary");
                        s.setTotalDistanceMeters(sNode.has("totalDistanceMeters") ? sNode.get("totalDistanceMeters").asInt() : 145);
                        s.setTotalDistanceFormatted(sNode.has("totalDistanceFormatted") ? sNode.get("totalDistanceFormatted").asText() : "145 m");
                        s.setDurationSeconds(sNode.has("durationSeconds") ? sNode.get("durationSeconds").asInt() : 66);
                        s.setTotalDurationFormatted(sNode.has("totalDurationFormatted") ? sNode.get("totalDurationFormatted").asText() : "00:01:06");
                        s.setMaxSpeedKmh(sNode.has("maxSpeedKmh") ? sNode.get("maxSpeedKmh").asInt() : 31);
                        s.setAverageSpeedKmh(sNode.has("averageSpeedKmh") ? sNode.get("averageSpeedKmh").asInt() : 8);
                        s.setRoutePointsCount(sNode.has("routePointsCount") ? sNode.get("routePointsCount").asInt() : 2);
                        s.setVisitedDestinationsCount(sNode.has("visitedDestinationsCount") ? sNode.get("visitedDestinationsCount").asInt() : 2);
                        s.setCompletedAt(sNode.has("completedAt") ? sNode.get("completedAt").asText() : null);
                        tripSummaryRepository.save(s);
                    }
                    log.info("Migrated {} trip summaries from db.json to MySQL.", sumNode.size());
                }
            }
        } catch (Exception ex) {
            log.error("Error during initial data migration: {}", ex.getMessage(), ex);
        }

        log.info("RoomTrail Data Migration and Seeding finished successfully.");
    }

    private Path findDbJsonPath() {
        Path[] candidates = new Path[]{
                Paths.get("db.json"),
                Paths.get("../db.json"),
                Paths.get("E:/Using AntiGravity/RoomTrail/db.json"),
                Paths.get("./RoomTrail/db.json")
        };
        for (Path p : candidates) {
            if (Files.exists(p)) return p;
        }
        return null;
    }
}
