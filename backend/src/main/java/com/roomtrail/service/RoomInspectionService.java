package com.roomtrail.service;

import com.roomtrail.dto.*;
import com.roomtrail.entity.InspectionItem;
import com.roomtrail.entity.Property;
import com.roomtrail.entity.RoomInspection;
import com.roomtrail.repository.InspectionItemRepository;
import com.roomtrail.repository.PropertyRepository;
import com.roomtrail.repository.RoomInspectionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class RoomInspectionService {

    private final RoomInspectionRepository roomInspectionRepository;
    private final InspectionItemRepository inspectionItemRepository;
    private final PropertyRepository propertyRepository;

    public static final Set<String> VALID_STATUSES = Set.of(
            "GOOD", "NEEDS_ATTENTION", "NOT_AVAILABLE", "UNMARKED"
    );

    public RoomInspectionService(RoomInspectionRepository roomInspectionRepository,
                                 InspectionItemRepository inspectionItemRepository,
                                 PropertyRepository propertyRepository) {
        this.roomInspectionRepository = roomInspectionRepository;
        this.inspectionItemRepository = inspectionItemRepository;
        this.propertyRepository = propertyRepository;
    }

    /**
     * Standard 34-item template across 6 categories
     */
    public List<InspectionItemDto> getDefaultChecklistTemplate() {
        List<InspectionItemDto> template = new ArrayList<>();

        // A. Room Condition
        template.add(new InspectionItemDto(null, "Room Condition", "walls_and_paint", "Walls and paint condition", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Room Condition", "ceiling_condition", "Ceiling condition", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Room Condition", "floor_condition", "Floor condition", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Room Condition", "doors_and_locks", "Doors and locks", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Room Condition", "windows_and_ventilation", "Windows and ventilation", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Room Condition", "water_leakage_dampness", "Water leakage or dampness", "UNMARKED", ""));

        // B. Bathroom
        template.add(new InspectionItemDto(null, "Bathroom", "bathroom_water_availability", "Water availability", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Bathroom", "bathroom_cleanliness", "Bathroom cleanliness", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Bathroom", "toilet_condition", "Toilet condition", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Bathroom", "shower_and_taps", "Shower and taps", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Bathroom", "bathroom_drainage", "Drainage", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Bathroom", "hot_water_availability", "Hot water availability", "UNMARKED", ""));

        // C. Electrical Facilities
        template.add(new InspectionItemDto(null, "Electrical Facilities", "lights_working", "Lights working", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Electrical Facilities", "fans_working", "Fans working", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Electrical Facilities", "power_sockets_working", "Power sockets working", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Electrical Facilities", "charging_points_available", "Charging points available", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Electrical Facilities", "power_backup_availability", "Power backup availability", "UNMARKED", ""));

        // D. Kitchen
        template.add(new InspectionItemDto(null, "Kitchen", "kitchen_availability", "Kitchen availability", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Kitchen", "cooking_facilities", "Cooking facilities", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Kitchen", "kitchen_water_availability", "Water availability", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Kitchen", "sink_and_drainage", "Sink and drainage", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Kitchen", "storage_space", "Storage space", "UNMARKED", ""));

        // E. Building and Security
        template.add(new InspectionItemDto(null, "Building and Security", "building_cleanliness", "Building cleanliness", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Building and Security", "entrance_security", "Entrance security", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Building and Security", "cctv_availability", "CCTV availability", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Building and Security", "lift_availability", "Lift availability", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Building and Security", "parking_availability", "Parking availability", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Building and Security", "fire_safety_arrangements", "Fire safety arrangements", "UNMARKED", ""));

        // F. Connectivity and Surroundings
        template.add(new InspectionItemDto(null, "Connectivity and Surroundings", "mobile_network_coverage", "Mobile network coverage", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Connectivity and Surroundings", "internet_availability", "Internet availability", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Connectivity and Surroundings", "public_transport_accessibility", "Public transport accessibility", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Connectivity and Surroundings", "nearby_grocery_stores", "Nearby grocery stores", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Connectivity and Surroundings", "noise_levels", "Noise levels", "UNMARKED", ""));
        template.add(new InspectionItemDto(null, "Connectivity and Surroundings", "overall_locality_condition", "Overall locality condition", "UNMARKED", ""));

        return template;
    }

    /**
     * Create inspection for property
     */
    @Transactional
    public RoomInspectionResponseDto createInspection(String propertyId, Long userId, RoomInspectionRequestDto request) {
        Property property = verifyPropertyOwnership(propertyId, userId);

        validateInspectionRequest(request);

        RoomInspection inspection = new RoomInspection();
        inspection.setPropertyId(propertyId);
        inspection.setUserId(userId);

        String dateStr = request.getInspectionDate();
        if (dateStr == null || dateStr.trim().isEmpty()) {
            dateStr = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
        }
        inspection.setInspectionDate(dateStr.trim());
        inspection.setOverallRating(request.getOverallRating());
        inspection.setOverallRemarks(request.getOverallRemarks());
        inspection.setSuitableForRent(request.getSuitableForRent());
        inspection.setAdditionalConcerns(request.getAdditionalConcerns());

        // Process checklist items
        applyItemsToInspection(inspection, request.getItems());

        RoomInspection saved = roomInspectionRepository.save(inspection);
        return mapToResponseDto(saved, property);
    }

    /**
     * Get all inspections for a property
     */
    @Transactional(readOnly = true)
    public List<RoomInspectionSummaryDto> getInspectionsByProperty(String propertyId, Long userId) {
        verifyPropertyOwnership(propertyId, userId);
        List<RoomInspection> list = roomInspectionRepository.findByPropertyIdAndUserIdOrderByInspectionDateDescCreatedAtDesc(propertyId, userId);
        List<RoomInspectionSummaryDto> results = new ArrayList<>();
        for (RoomInspection ri : list) {
            results.add(mapToSummaryDto(ri));
        }
        return results;
    }

    /**
     * Get single inspection by ID
     */
    @Transactional(readOnly = true)
    public RoomInspectionResponseDto getInspectionById(Long inspectionId, Long userId) {
        RoomInspection inspection = roomInspectionRepository.findById(inspectionId)
                .orElse(null);
        if (inspection == null) return null;

        if (userId == null || !userId.equals(inspection.getUserId())) {
            throw new SecurityException("User does not have permission to access inspection: " + inspectionId);
        }

        Property property = propertyRepository.findById(inspection.getPropertyId()).orElse(null);
        return mapToResponseDto(inspection, property);
    }

    /**
     * Get latest inspection summary for a property
     */
    @Transactional(readOnly = true)
    public RoomInspectionSummaryDto getLatestInspectionSummary(String propertyId, Long userId) {
        verifyPropertyOwnership(propertyId, userId);
        return roomInspectionRepository.findFirstByPropertyIdAndUserIdOrderByInspectionDateDescCreatedAtDesc(propertyId, userId)
                .map(this::mapToSummaryDto)
                .orElse(null);
    }

    /**
     * Update existing inspection
     */
    @Transactional
    public RoomInspectionResponseDto updateInspection(Long inspectionId, Long userId, RoomInspectionRequestDto request) {
        RoomInspection inspection = roomInspectionRepository.findById(inspectionId)
                .orElse(null);
        if (inspection == null) return null;

        if (userId == null || !userId.equals(inspection.getUserId())) {
            throw new SecurityException("User does not have permission to access inspection: " + inspectionId);
        }

        Property property = verifyPropertyOwnership(inspection.getPropertyId(), userId);
        validateInspectionRequest(request);

        if (request.getInspectionDate() != null && !request.getInspectionDate().trim().isEmpty()) {
            inspection.setInspectionDate(request.getInspectionDate().trim());
        }
        inspection.setOverallRating(request.getOverallRating());
        inspection.setOverallRemarks(request.getOverallRemarks());
        inspection.setSuitableForRent(request.getSuitableForRent());
        inspection.setAdditionalConcerns(request.getAdditionalConcerns());

        if (request.getItems() != null) {
            applyItemsToInspection(inspection, request.getItems());
        }

        RoomInspection saved = roomInspectionRepository.save(inspection);
        return mapToResponseDto(saved, property);
    }

    /**
     * Delete inspection
     */
    @Transactional
    public boolean deleteInspection(Long inspectionId, Long userId) {
        RoomInspection inspection = roomInspectionRepository.findById(inspectionId)
                .orElse(null);
        if (inspection == null) return false;

        if (userId == null || !userId.equals(inspection.getUserId())) {
            throw new SecurityException("User does not have permission to access inspection: " + inspectionId);
        }
        roomInspectionRepository.delete(inspection);
        return true;
    }

    /**
     * Validate ownership of a property
     */
    public Property verifyPropertyOwnership(String propertyId, Long userId) {
        if (propertyId == null || propertyId.trim().isEmpty()) {
            throw new IllegalArgumentException("Property ID must not be empty");
        }
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new NoSuchElementException("Property not found with ID: " + propertyId));

        String propUserId = property.getUserId();
        boolean isOwner = false;
        if (userId != null && propUserId != null) {
            try {
                isOwner = Long.parseLong(propUserId.trim()) == userId;
            } catch (NumberFormatException e) {
                isOwner = propUserId.trim().equalsIgnoreCase(String.valueOf(userId));
            }
        }
        if (!isOwner) {
            throw new SecurityException("User does not have permission to access property: " + propertyId);
        }
        return property;
    }

    /**
     * Validation helper for inspection request
     */
    private void validateInspectionRequest(RoomInspectionRequestDto request) {
        if (request == null) {
            throw new IllegalArgumentException("Inspection request body is required");
        }

        // Validate Rating (1-5)
        if (request.getOverallRating() != null) {
            if (request.getOverallRating() < 1 || request.getOverallRating() > 5) {
                throw new IllegalArgumentException("Overall rating must be between 1 and 5 (inclusive)");
            }
        }

        // Validate Remarks length
        if (request.getOverallRemarks() != null && request.getOverallRemarks().length() > 2000) {
            throw new IllegalArgumentException("Overall remarks must not exceed 2000 characters");
        }

        // Validate Additional Concerns length
        if (request.getAdditionalConcerns() != null && request.getAdditionalConcerns().length() > 1000) {
            throw new IllegalArgumentException("Additional concerns must not exceed 1000 characters");
        }

        // Validate items and duplicate keys
        if (request.getItems() != null && !request.getItems().isEmpty()) {
            Set<String> seenKeys = new HashSet<>();
            for (InspectionItemDto item : request.getItems()) {
                if (item.getItemKey() == null || item.getItemKey().trim().isEmpty()) {
                    throw new IllegalArgumentException("Checklist item key cannot be blank");
                }
                String normalizedKey = item.getItemKey().trim().toLowerCase();
                if (!seenKeys.add(normalizedKey)) {
                    throw new IllegalArgumentException("Duplicate checklist item key found: " + item.getItemKey());
                }

                // Status validation
                if (item.getStatus() != null && !item.getStatus().trim().isEmpty()) {
                    String normStatus = item.getStatus().trim().toUpperCase().replace(" ", "_");
                    if (!VALID_STATUSES.contains(normStatus)) {
                        throw new IllegalArgumentException("Invalid status '" + item.getStatus() + "'. Allowed: GOOD, NEEDS_ATTENTION, NOT_AVAILABLE, UNMARKED");
                    }
                }

                // Comment length validation
                if (item.getComment() != null && item.getComment().length() > 500) {
                    throw new IllegalArgumentException("Item comment cannot exceed 500 characters for item: " + item.getItemKey());
                }
            }
        }
    }

    private void applyItemsToInspection(RoomInspection inspection, List<InspectionItemDto> itemDtos) {
        if (itemDtos == null) {
            return;
        }

        Map<String, InspectionItem> existingMap = new HashMap<>();
        for (InspectionItem existing : inspection.getItems()) {
            if (existing.getItemKey() != null) {
                existingMap.put(existing.getItemKey().toLowerCase(), existing);
            }
        }

        List<InspectionItem> updatedList = new ArrayList<>();
        for (InspectionItemDto dto : itemDtos) {
            String key = dto.getItemKey().trim().toLowerCase();
            String normStatus = "UNMARKED";
            if (dto.getStatus() != null && !dto.getStatus().trim().isEmpty()) {
                String clean = dto.getStatus().trim().toUpperCase().replace(" ", "_");
                if (VALID_STATUSES.contains(clean)) {
                    normStatus = clean;
                }
            }

            InspectionItem item = existingMap.get(key);
            if (item != null) {
                if (dto.getCategory() != null && !dto.getCategory().trim().isEmpty()) {
                    item.setCategory(dto.getCategory().trim());
                }
                if (dto.getItemLabel() != null && !dto.getItemLabel().trim().isEmpty()) {
                    item.setItemLabel(dto.getItemLabel().trim());
                }
                item.setStatus(normStatus);
                item.setComment(dto.getComment() != null ? dto.getComment().trim() : "");
                updatedList.add(item);
            } else {
                InspectionItem newItem = new InspectionItem(
                        inspection,
                        dto.getCategory() != null ? dto.getCategory().trim() : "Room Condition",
                        key,
                        dto.getItemLabel() != null ? dto.getItemLabel().trim() : dto.getItemKey(),
                        normStatus,
                        dto.getComment() != null ? dto.getComment().trim() : ""
                );
                updatedList.add(newItem);
            }
        }

        inspection.getItems().retainAll(updatedList);
        for (InspectionItem it : updatedList) {
            if (!inspection.getItems().contains(it)) {
                inspection.addItem(it);
            }
        }
    }

    public RoomInspectionResponseDto mapToResponseDto(RoomInspection inspection, Property property) {
        RoomInspectionResponseDto dto = new RoomInspectionResponseDto();
        dto.setId(inspection.getId());
        dto.setPropertyId(inspection.getPropertyId());
        if (property != null) {
            dto.setPropertyName(property.getName());
            dto.setPropertyAddress(property.getAddress());
        }
        dto.setUserId(inspection.getUserId());
        dto.setInspectionDate(inspection.getInspectionDate());
        dto.setOverallRating(inspection.getOverallRating());
        dto.setOverallRemarks(inspection.getOverallRemarks());
        dto.setSuitableForRent(inspection.getSuitableForRent());
        dto.setAdditionalConcerns(inspection.getAdditionalConcerns());
        dto.setCreatedAt(inspection.getCreatedAt());
        dto.setUpdatedAt(inspection.getUpdatedAt());

        int total = 0;
        int inspected = 0;
        int good = 0;
        int needsAttn = 0;
        int notAvail = 0;

        List<InspectionItemDto> itemDtos = new ArrayList<>();
        if (inspection.getItems() != null) {
            for (InspectionItem item : inspection.getItems()) {
                total++;
                String st = item.getStatus() != null ? item.getStatus().toUpperCase() : "UNMARKED";
                if ("GOOD".equals(st)) {
                    good++;
                    inspected++;
                } else if ("NEEDS_ATTENTION".equals(st)) {
                    needsAttn++;
                    inspected++;
                } else if ("NOT_AVAILABLE".equals(st)) {
                    notAvail++;
                    inspected++;
                }

                itemDtos.add(new InspectionItemDto(
                        item.getId(),
                        item.getCategory(),
                        item.getItemKey(),
                        item.getItemLabel(),
                        st,
                        item.getComment()
                ));
            }
        }

        dto.setTotalItems(total);
        dto.setInspectedItems(inspected);
        dto.setGoodCount(good);
        dto.setNeedsAttentionCount(needsAttn);
        dto.setNotAvailableCount(notAvail);
        dto.setCompletionPercentage(total > 0 ? (int) Math.round(((double) inspected / total) * 100) : 0);
        dto.setItems(itemDtos);

        return dto;
    }

    public RoomInspectionSummaryDto mapToSummaryDto(RoomInspection inspection) {
        RoomInspectionSummaryDto dto = new RoomInspectionSummaryDto();
        dto.setId(inspection.getId());
        dto.setPropertyId(inspection.getPropertyId());
        dto.setInspectionDate(inspection.getInspectionDate());
        dto.setOverallRating(inspection.getOverallRating());
        dto.setSuitableForRent(inspection.getSuitableForRent());
        dto.setCreatedAt(inspection.getCreatedAt());
        dto.setUpdatedAt(inspection.getUpdatedAt());

        int total = 0;
        int inspected = 0;
        int good = 0;
        int needsAttn = 0;
        int notAvail = 0;

        if (inspection.getItems() != null) {
            for (InspectionItem item : inspection.getItems()) {
                total++;
                String st = item.getStatus() != null ? item.getStatus().toUpperCase() : "UNMARKED";
                if ("GOOD".equals(st)) {
                    good++;
                    inspected++;
                } else if ("NEEDS_ATTENTION".equals(st)) {
                    needsAttn++;
                    inspected++;
                } else if ("NOT_AVAILABLE".equals(st)) {
                    notAvail++;
                    inspected++;
                }
            }
        }

        dto.setTotalItems(total);
        dto.setInspectedItems(inspected);
        dto.setGoodCount(good);
        dto.setNeedsAttentionCount(needsAttn);
        dto.setNotAvailableCount(notAvail);
        dto.setCompletionPercentage(total > 0 ? (int) Math.round(((double) inspected / total) * 100) : 0);

        if (inspection.getOverallRemarks() != null && !inspection.getOverallRemarks().trim().isEmpty()) {
            String r = inspection.getOverallRemarks().trim();
            dto.setRemarksSnippet(r.length() > 120 ? r.substring(0, 117) + "..." : r);
        }
        if (inspection.getAdditionalConcerns() != null && !inspection.getAdditionalConcerns().trim().isEmpty()) {
            String c = inspection.getAdditionalConcerns().trim();
            dto.setConcernsSnippet(c.length() > 120 ? c.substring(0, 117) + "..." : c);
        }

        return dto;
    }
}
