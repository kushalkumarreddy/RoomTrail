package com.roomtrail.controller;

import com.roomtrail.dto.PropertyComparisonDto;
import com.roomtrail.entity.Property;
import com.roomtrail.entity.User;
import com.roomtrail.repository.UserRepository;
import com.roomtrail.security.UserPrincipal;
import com.roomtrail.service.PropertyService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/properties")
public class PropertyController {

    private final PropertyService propertyService;
    private final UserRepository userRepository;

    public PropertyController(PropertyService propertyService, UserRepository userRepository) {
        this.propertyService = propertyService;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<List<Property>> getAllProperties(@RequestParam(required = false) Long userId,
                                                           @RequestParam(required = false) Boolean favorite,
                                                           Authentication authentication) {
        Long authenticatedId = getUserId(authentication);
        boolean admin = isAdmin(authentication);
        Long effectiveUserId = admin ? userId : authenticatedId;
        if (Boolean.TRUE.equals(favorite)) {
            return ResponseEntity.ok(propertyService.getFavorites(effectiveUserId));
        }
        return ResponseEntity.ok(propertyService.getAll(effectiveUserId));
    }

    @GetMapping("/favorites")
    public ResponseEntity<List<Property>> getFavorites(Authentication authentication) {
        Long authenticatedId = getUserId(authentication);
        if (authenticatedId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(propertyService.getFavorites(authenticatedId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Property> getPropertyById(@PathVariable String id, Authentication authentication) {
        Property property = propertyService.getById(id);
        if (property == null) {
            return ResponseEntity.notFound().build();
        }
        Long authenticatedId = getUserId(authentication);
        if (!isAdmin(authentication) && !isOwner(property.getUserId(), authenticatedId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(property);
    }

    @PostMapping
    public ResponseEntity<Property> createProperty(@RequestBody Property property,
                                                   Authentication authentication) {
        Long userId = getUserId(authentication);
        Property created = propertyService.create(property, userId);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<Property> patchProperty(@PathVariable String id,
                                                  @RequestBody Map<String, Object> updates,
                                                  Authentication authentication) {
        Property existing = propertyService.getById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        Long authenticatedId = getUserId(authentication);
        if (!isAdmin(authentication) && !isOwner(existing.getUserId(), authenticatedId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(propertyService.update(id, updates));
    }

    @PatchMapping("/{id}/notes")
    public ResponseEntity<?> updatePropertyNotes(@PathVariable String id,
                                                 @RequestBody Map<String, Object> body,
                                                 Authentication authentication) {
        Property existing = propertyService.getById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        Long authenticatedId = getUserId(authentication);
        if (!isAdmin(authentication) && !isOwner(existing.getUserId(), authenticatedId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Access denied. You do not own this property."));
        }
        Object notesObj = body != null ? body.get("notes") : null;
        String notesStr = notesObj != null ? notesObj.toString() : "";
        if (notesStr.length() > 5000) {
            return ResponseEntity.badRequest().body(Map.of("message", "Personal notes cannot exceed 5000 characters."));
        }
        Map<String, Object> updates = new HashMap<>();
        updates.put("notes", notesStr);
        return ResponseEntity.ok(propertyService.update(id, updates));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Property> updateProperty(@PathVariable String id,
                                                   @RequestBody Map<String, Object> updates,
                                                   Authentication authentication) {
        Property existing = propertyService.getById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        Long authenticatedId = getUserId(authentication);
        if (!isAdmin(authentication) && !isOwner(existing.getUserId(), authenticatedId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(propertyService.update(id, updates));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProperty(@PathVariable String id, Authentication authentication) {
        Property existing = propertyService.getById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        Long authenticatedId = getUserId(authentication);
        if (!isAdmin(authentication) && !isOwner(existing.getUserId(), authenticatedId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        propertyService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Mark or remove a room as favourite (Phase 3)
     * Strictly verifies authenticated ownership on every request.
     */
    @RequestMapping(value = "/{id}/favorite", method = {RequestMethod.PATCH, RequestMethod.POST, RequestMethod.PUT})
    public ResponseEntity<?> toggleFavorite(@PathVariable String id,
                                           @RequestBody(required = false) Map<String, Object> body,
                                           Authentication authentication) {
        Property existing = propertyService.getById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        Long authenticatedId = getUserId(authentication);
        if (authenticatedId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        // Strict ownership validation: user cannot favourite another user's property
        if (!isAdmin(authentication) && !isOwner(existing.getUserId(), authenticatedId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Access denied. You can only manage favourites for your own saved rooms."));
        }

        Boolean explicitStatus = null;
        if (body != null) {
            if (body.containsKey("isFavorite")) {
                Object v = body.get("isFavorite");
                explicitStatus = v instanceof Boolean ? (Boolean) v : Boolean.parseBoolean(String.valueOf(v));
            } else if (body.containsKey("favorite")) {
                Object v = body.get("favorite");
                explicitStatus = v instanceof Boolean ? (Boolean) v : Boolean.parseBoolean(String.valueOf(v));
            }
        }

        Property updated = propertyService.toggleFavorite(id, authenticatedId, explicitStatus);
        return ResponseEntity.ok(Map.of(
                "id", updated.getId(),
                "name", updated.getName(),
                "isFavorite", updated.getIsFavorite(),
                "favorite", updated.getIsFavorite(),
                "message", Boolean.TRUE.equals(updated.getIsFavorite())
                        ? "Marked as favourite"
                        : "Removed from favourites"
        ));
    }

    /**
     * Compare multiple saved rooms side-by-side (Phase 2)
     * Strictly verifies authenticated ownership for every requested room.
     */
    @PostMapping("/compare")
    public ResponseEntity<?> compareProperties(@RequestBody Map<String, Object> body,
                                               Authentication authentication) {
        Long authenticatedId = getUserId(authentication);
        if (authenticatedId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Object idsObj = body.get("propertyIds");
        if (!(idsObj instanceof List<?> rawList)) {
            return ResponseEntity.badRequest().body(Map.of("message", "propertyIds list is required."));
        }

        List<String> propertyIds = new ArrayList<>();
        for (Object o : rawList) {
            if (o != null && !o.toString().trim().isEmpty()) {
                propertyIds.add(o.toString().trim());
            }
        }

        if (propertyIds.size() < 2) {
            return ResponseEntity.badRequest().body(Map.of("message", "At least two rooms are required for comparison."));
        }
        if (propertyIds.size() > 4) {
            return ResponseEntity.badRequest().body(Map.of("message", "A maximum of four rooms can be compared at a time."));
        }

        // Determine reference coordinates (either from request or from user's homeLat/homeLng)
        Double refLat = null;
        Double refLng = null;
        if (body.get("refLat") != null) {
            try { refLat = Double.valueOf(body.get("refLat").toString()); } catch (Exception ignored) {}
        }
        if (body.get("refLng") != null) {
            try { refLng = Double.valueOf(body.get("refLng").toString()); } catch (Exception ignored) {}
        }
        if (refLat == null || refLng == null) {
            Optional<User> userOpt = userRepository.findById(authenticatedId);
            if (userOpt.isPresent()) {
                refLat = userOpt.get().getHomeLat();
                refLng = userOpt.get().getHomeLng();
            }
        }

        List<PropertyComparisonDto> result = new ArrayList<>();
        for (String id : propertyIds) {
            Property prop = propertyService.getById(id);
            if (prop == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("message", "Property not found with id: " + id));
            }

            // Strict ownership verification: users can only compare their own saved rooms
            if (!isAdmin(authentication) && !isOwner(prop.getUserId(), authenticatedId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Access denied. You can only compare your own saved rooms."));
            }

            PropertyComparisonDto dto = new PropertyComparisonDto();
            dto.setId(prop.getId());
            dto.setName(prop.getName() != null && !prop.getName().isBlank() ? prop.getName() : "Not provided");
            dto.setCategory(prop.getCategory() != null && !prop.getCategory().isBlank() ? prop.getCategory().toUpperCase() : "Not provided");
            dto.setRent(prop.getRent() != null && !prop.getRent().isBlank() ? prop.getRent() : (prop.getPrice() != null && !prop.getPrice().isBlank() ? prop.getPrice() : "Not provided"));
            dto.setAddress(prop.getAddress() != null && !prop.getAddress().isBlank() ? prop.getAddress() : "Not provided");
            dto.setCity(prop.getCity() != null && !prop.getCity().isBlank() ? prop.getCity() : "Not provided");
            dto.setLatitude(prop.getLatitude());
            dto.setLongitude(prop.getLongitude());
            dto.setAmenities(prop.getAmenities());
            dto.setVisited(prop.getVisited());
            dto.setVisitStatus(prop.getVisitStatus());
            dto.setNotes(prop.getNotes() != null && !prop.getNotes().isBlank() ? prop.getNotes() : "Not provided");
            dto.setIsFavorite(prop.getIsFavorite());

            // Distance calculation
            if (refLat != null && refLng != null && prop.getLatitude() != null && prop.getLongitude() != null) {
                double distMeters = calculateHaversineDistanceMeters(refLat, refLng, prop.getLatitude(), prop.getLongitude());
                dto.setDistanceMeters(distMeters);
                dto.setDistance(distMeters < 1000 ? String.format("%.0f m", distMeters) : String.format("%.1f km", distMeters / 1000.0));
            } else {
                dto.setDistance("Not provided");
                dto.setDistanceMeters(null);
            }

            // Facilities detection from amenities / notes
            List<String> amenities = prop.getAmenities() != null ? prop.getAmenities() : Collections.emptyList();
            String notesLower = prop.getNotes() != null ? prop.getNotes().toLowerCase() : "";

            // Water
            boolean hasWater = amenities.stream().anyMatch(a -> a.toLowerCase().contains("water"))
                    || notesLower.contains("water") || notesLower.contains("drinking water");
            dto.setWater(hasWater ? "Available" : "Not provided");

            // Parking
            boolean hasParking = amenities.stream().anyMatch(a -> a.toLowerCase().contains("parking"))
                    || notesLower.contains("parking");
            dto.setParking(hasParking ? "Available" : "Not provided");

            // Wi-Fi
            boolean hasWifi = amenities.stream().anyMatch(a -> a.toLowerCase().contains("wi-fi") || a.toLowerCase().contains("wifi"))
                    || notesLower.contains("wi-fi") || notesLower.contains("wifi");
            dto.setWifi(hasWifi ? "Available" : "Not provided");

            // Bathroom
            boolean hasBath = amenities.stream().anyMatch(a -> a.toLowerCase().contains("bath"))
                    || notesLower.contains("bath") || notesLower.contains("attached bathroom");
            dto.setBathroom(hasBath ? "Available" : "Not provided");

            // Ventilation
            boolean hasVent = amenities.stream().anyMatch(a -> a.toLowerCase().contains("balcony") || a.toLowerCase().contains("air conditioning"))
                    || notesLower.contains("ventilation") || notesLower.contains("ventilated") || notesLower.contains("balcony");
            dto.setVentilation(hasVent ? "Available" : "Not provided");

            // Security
            boolean hasSecurity = amenities.stream().anyMatch(a -> a.toLowerCase().contains("security") || a.toLowerCase().contains("cctv") || a.toLowerCase().contains("gated"))
                    || notesLower.contains("security") || notesLower.contains("cctv");
            dto.setSecurity(hasSecurity ? "Available" : "Not provided");

            // Personal Rating
            if (prop.getPriority() != null && !prop.getPriority().isBlank()) {
                String p = prop.getPriority().trim();
                dto.setRating(p.substring(0, 1).toUpperCase() + p.substring(1).toLowerCase() + " Priority");
            } else {
                dto.setRating("Not provided");
            }

            result.add(dto);
        }

        return ResponseEntity.ok(result);
    }

    private double calculateHaversineDistanceMeters(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371000;
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private Long getUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal up) {
            return up.getId();
        }
        return null;
    }

    private boolean isAdmin(Authentication authentication) {
        if (authentication == null) return false;
        return authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_ADMIN") || a.getAuthority().equalsIgnoreCase("ADMIN"));
    }

    private boolean isOwner(String entityUserId, Long authenticatedId) {
        if (authenticatedId == null) return false;
        if (entityUserId == null) return true;
        try {
            return Long.parseLong(entityUserId.trim()) == authenticatedId;
        } catch (NumberFormatException e) {
            return entityUserId.trim().equalsIgnoreCase(String.valueOf(authenticatedId));
        }
    }
}
