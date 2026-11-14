package com.roomtrail.controller;

import com.roomtrail.entity.Property;
import com.roomtrail.security.UserPrincipal;
import com.roomtrail.service.PropertyService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/properties")
public class PropertyController {

    private final PropertyService propertyService;

    public PropertyController(PropertyService propertyService) {
        this.propertyService = propertyService;
    }

    @GetMapping
    public ResponseEntity<List<Property>> getAllProperties(@RequestParam(required = false) Long userId,
                                                           Authentication authentication) {
        Long effectiveUserId = userId != null ? userId : getUserId(authentication);
        return ResponseEntity.ok(propertyService.getAll(effectiveUserId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Property> getPropertyById(@PathVariable String id) {
        return ResponseEntity.ok(propertyService.getById(id));
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
                                                  @RequestBody Map<String, Object> updates) {
        return ResponseEntity.ok(propertyService.update(id, updates));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Property> updateProperty(@PathVariable String id,
                                                  @RequestBody Map<String, Object> updates) {
        return ResponseEntity.ok(propertyService.update(id, updates));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProperty(@PathVariable String id) {
        propertyService.delete(id);
        return ResponseEntity.noContent().build();
    }

    private Long getUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal up) {
            return up.getId();
        }
        return null;
    }
}
