package com.roomtrail.controller;

import com.roomtrail.security.UserPrincipal;
import com.roomtrail.service.TravelHistoryExportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;

@RestController
@RequestMapping("/api/travel-history/export")
public class TravelHistoryExportController {

    private final TravelHistoryExportService exportService;

    public TravelHistoryExportController(TravelHistoryExportService exportService) {
        this.exportService = exportService;
    }

    /**
     * Export Trip-Level CSV
     */
    @GetMapping("/csv")
    public ResponseEntity<?> exportTripsCsv(@RequestParam(required = false) String startDate,
                                            @RequestParam(required = false) String endDate,
                                            @RequestParam(required = false, defaultValue = "true") boolean includeStops,
                                            Authentication authentication) {
        if (isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Administrators are not permitted to export private user travel histories"));
        }
        Long userId = getUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String validationError = validateDateRange(startDate, endDate);
        if (validationError != null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", validationError));
        }

        byte[] csvBytes = exportService.generateTripsCsv(userId, startDate, endDate, includeStops);
        String filename = "roomtrail_travel_history_" + LocalDate.now() + ".csv";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .header(HttpHeaders.CONTENT_TYPE, "text/csv; charset=UTF-8")
                .body(csvBytes);
    }

    /**
     * Export Actual Recorded Route Points CSV
     */
    @GetMapping("/route-points")
    public ResponseEntity<?> exportRoutePointsCsv(@RequestParam(required = false) String startDate,
                                                  @RequestParam(required = false) String endDate,
                                                  Authentication authentication) {
        if (isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Administrators are not permitted to export private user travel histories"));
        }
        Long userId = getUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String validationError = validateDateRange(startDate, endDate);
        if (validationError != null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", validationError));
        }

        byte[] csvBytes = exportService.generateRoutePointsCsv(userId, startDate, endDate);
        String filename = "roomtrail_route_points_" + LocalDate.now() + ".csv";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .header(HttpHeaders.CONTENT_TYPE, "text/csv; charset=UTF-8")
                .body(csvBytes);
    }

    /**
     * Export Professional Travel History PDF Report
     */
    @GetMapping("/pdf")
    public ResponseEntity<?> exportTravelHistoryPdf(@RequestParam(required = false) String startDate,
                                                    @RequestParam(required = false) String endDate,
                                                    @RequestParam(required = false, defaultValue = "true") boolean includeStops,
                                                    Authentication authentication) {
        if (isAdmin(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Administrators are not permitted to export private user travel histories"));
        }
        Long userId = getUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String validationError = validateDateRange(startDate, endDate);
        if (validationError != null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", validationError));
        }

        byte[] pdfBytes = exportService.generateTravelHistoryPdf(userId, startDate, endDate, includeStops);
        String filename = "roomtrail_travel_history_" + LocalDate.now() + ".pdf";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }

    // --- Validation & Helpers ---

    private String validateDateRange(String startDate, String endDate) {
        LocalDate start = null;
        LocalDate end = null;

        if (startDate != null && !startDate.isBlank()) {
            try {
                start = LocalDate.parse(startDate.trim());
            } catch (DateTimeParseException e) {
                return "Invalid start date format. Expected YYYY-MM-DD";
            }
        }

        if (endDate != null && !endDate.isBlank()) {
            try {
                end = LocalDate.parse(endDate.trim());
            } catch (DateTimeParseException e) {
                return "Invalid end date format. Expected YYYY-MM-DD";
            }
        }

        if (start != null && end != null && start.isAfter(end)) {
            return "Start date cannot be after end date";
        }

        return null;
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
