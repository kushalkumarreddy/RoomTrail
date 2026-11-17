package com.roomtrail.controller;

import com.roomtrail.dto.InspectionItemDto;
import com.roomtrail.dto.RoomInspectionRequestDto;
import com.roomtrail.dto.RoomInspectionResponseDto;
import com.roomtrail.dto.RoomInspectionSummaryDto;
import com.roomtrail.security.UserPrincipal;
import com.roomtrail.service.RoomInspectionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api")
public class RoomInspectionController {

    private final RoomInspectionService roomInspectionService;

    public RoomInspectionController(RoomInspectionService roomInspectionService) {
        this.roomInspectionService = roomInspectionService;
    }

    /**
     * Standard checklist template items (34 items)
     */
    @GetMapping("/inspections/template")
    public ResponseEntity<List<InspectionItemDto>> getChecklistTemplate() {
        return ResponseEntity.ok(roomInspectionService.getDefaultChecklistTemplate());
    }

    /**
     * List all inspections for an owned property
     */
    @GetMapping("/properties/{propertyId}/inspections")
    public ResponseEntity<?> getInspectionsForProperty(@PathVariable String propertyId,
                                                       Authentication authentication) {
        if (isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access to private inspection details is forbidden"));
        }
        Long authenticatedId = getUserId(authentication);
        if (authenticatedId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            List<RoomInspectionSummaryDto> list = roomInspectionService.getInspectionsByProperty(propertyId, authenticatedId);
            return ResponseEntity.ok(list);
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get latest inspection summary for an owned property (for room card/details badge)
     */
    @GetMapping("/properties/{propertyId}/inspections/latest")
    public ResponseEntity<?> getLatestInspectionForProperty(@PathVariable String propertyId,
                                                            Authentication authentication) {
        if (isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access to private inspection details is forbidden"));
        }
        Long authenticatedId = getUserId(authentication);
        if (authenticatedId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            RoomInspectionSummaryDto summary = roomInspectionService.getLatestInspectionSummary(propertyId, authenticatedId);
            if (summary == null) {
                return ResponseEntity.noContent().build();
            }
            return ResponseEntity.ok(summary);
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Create new inspection for an owned property
     */
    @PostMapping("/properties/{propertyId}/inspections")
    public ResponseEntity<?> createInspection(@PathVariable String propertyId,
                                              @RequestBody RoomInspectionRequestDto request,
                                              Authentication authentication) {
        if (isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access to private inspection details is forbidden"));
        }
        Long authenticatedId = getUserId(authentication);
        if (authenticatedId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            RoomInspectionResponseDto created = roomInspectionService.createInspection(propertyId, authenticatedId, request);
            return new ResponseEntity<>(created, HttpStatus.CREATED);
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get single inspection by ID
     */
    @GetMapping("/inspections/{inspectionId}")
    public ResponseEntity<?> getInspectionById(@PathVariable Long inspectionId,
                                               Authentication authentication) {
        if (isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access to private inspection details is forbidden"));
        }
        Long authenticatedId = getUserId(authentication);
        if (authenticatedId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            RoomInspectionResponseDto response = roomInspectionService.getInspectionById(inspectionId, authenticatedId);
            if (response == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Inspection not found"));
            }
            return ResponseEntity.ok(response);
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Update existing inspection
     */
    @PutMapping("/inspections/{inspectionId}")
    public ResponseEntity<?> updateInspection(@PathVariable Long inspectionId,
                                              @RequestBody RoomInspectionRequestDto request,
                                              Authentication authentication) {
        if (isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access to private inspection details is forbidden"));
        }
        Long authenticatedId = getUserId(authentication);
        if (authenticatedId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            RoomInspectionResponseDto updated = roomInspectionService.updateInspection(inspectionId, authenticatedId, request);
            if (updated == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Inspection not found"));
            }
            return ResponseEntity.ok(updated);
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Delete inspection
     */
    @DeleteMapping("/inspections/{inspectionId}")
    public ResponseEntity<?> deleteInspection(@PathVariable Long inspectionId,
                                              Authentication authentication) {
        if (isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Admin access to private inspection details is forbidden"));
        }
        Long authenticatedId = getUserId(authentication);
        if (authenticatedId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            boolean deleted = roomInspectionService.deleteInspection(inspectionId, authenticatedId);
            if (!deleted) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }
            return ResponseEntity.noContent().build();
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        }
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
}
