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
        Long effectiveUserId = userId != null ? userId : getUserId(authentication);
        return ResponseEntity.ok(visitService.getAll(effectiveUserId, tripId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Visit> getVisitById(@PathVariable String id) {
        return ResponseEntity.ok(visitService.getById(id));
    }

    @PostMapping
    public ResponseEntity<Visit> createVisit(@RequestBody Visit visit,
                                             Authentication authentication) {
        Long userId = getUserId(authentication);
        Visit created = visitService.create(visit, userId);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteVisit(@PathVariable String id) {
        visitService.delete(id);
        return ResponseEntity.noContent().build();
    }

    private Long getUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal up) {
            return up.getId();
        }
        return null;
    }
}
