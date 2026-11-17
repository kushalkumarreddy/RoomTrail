package com.roomtrail.controller;

import com.roomtrail.entity.Visit;
import com.roomtrail.security.UserPrincipal;
import com.roomtrail.service.VisitService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/visits")
public class VisitController {

    private final VisitService visitService;

    public VisitController(VisitService visitService) {
        this.visitService = visitService;
    }

    @GetMapping
    public ResponseEntity<List<Visit>> getAllVisits(@RequestParam(required = false) Long userId,
                                                    @RequestParam(required = false) String tripId,
                                                    Authentication authentication) {
        Long authenticatedId = getUserId(authentication);
        boolean admin = isAdmin(authentication);
        Long effectiveUserId = admin ? userId : authenticatedId;
        return ResponseEntity.ok(visitService.getAll(effectiveUserId, tripId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Visit> getVisitById(@PathVariable String id, Authentication authentication) {
        Visit visit = visitService.getById(id);
        if (visit == null) {
            return ResponseEntity.notFound().build();
        }
        Long authenticatedId = getUserId(authentication);
        if (!isAdmin(authentication) && !isOwner(visit.getUserId(), authenticatedId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(visit);
    }

    @PostMapping
    public ResponseEntity<Visit> createVisit(@RequestBody Visit visit,
                                             Authentication authentication) {
        Long userId = getUserId(authentication);
        Visit created = visitService.create(visit, userId);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteVisit(@PathVariable String id, Authentication authentication) {
        Visit visit = visitService.getById(id);
        if (visit == null) {
            return ResponseEntity.notFound().build();
        }
        Long authenticatedId = getUserId(authentication);
        if (!isAdmin(authentication) && !isOwner(visit.getUserId(), authenticatedId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        visitService.delete(id);
        return ResponseEntity.noContent().build();
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
