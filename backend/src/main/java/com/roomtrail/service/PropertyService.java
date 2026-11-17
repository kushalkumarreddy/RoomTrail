package com.roomtrail.service;

import com.roomtrail.entity.Property;
import com.roomtrail.exception.ResourceNotFoundException;
import com.roomtrail.repository.PropertyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class PropertyService {

    private final PropertyRepository propertyRepository;

    public PropertyService(PropertyRepository propertyRepository) {
        this.propertyRepository = propertyRepository;
    }

    public List<Property> getAll(Long userId) {
        if (userId != null) {
            return propertyRepository.findByUserId(userId);
        }
        return propertyRepository.findAll();
    }

    public Property getById(String id) {
        return propertyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Property not found with id: " + id));
    }

    @Transactional
    public Property create(Property property, Long userId) {
        if (userId != null) {
            property.setUserId(userId);
        }
        if (property.getId() == null || property.getId().trim().isEmpty()) {
            property.setId(String.valueOf(System.currentTimeMillis()));
        }
        return propertyRepository.save(property);
    }

    @Transactional
    public Property update(String id, Map<String, Object> updates) {
        Property property = getById(id);

        if (updates.containsKey("name")) property.setName((String) updates.get("name"));
        if (updates.containsKey("category")) property.setCategory((String) updates.get("category"));
        if (updates.containsKey("address")) property.setAddress((String) updates.get("address"));
        if (updates.containsKey("city")) property.setCity((String) updates.get("city"));
        if (updates.containsKey("latitude") && updates.get("latitude") != null) {
            property.setLatitude(((Number) updates.get("latitude")).doubleValue());
        }
        if (updates.containsKey("longitude") && updates.get("longitude") != null) {
            property.setLongitude(((Number) updates.get("longitude")).doubleValue());
        }
        if (updates.containsKey("description")) property.setDescription((String) updates.get("description"));
        if (updates.containsKey("priority")) property.setPriority((String) updates.get("priority"));
        if (updates.containsKey("rent")) property.setRent((String) updates.get("rent"));
        if (updates.containsKey("price")) property.setPrice((String) updates.get("price"));
        if (updates.containsKey("contactPerson")) property.setContactPerson((String) updates.get("contactPerson"));
        if (updates.containsKey("contactPhone")) property.setContactPhone((String) updates.get("contactPhone"));
        if (updates.containsKey("contactNumber")) property.setContactNumber((String) updates.get("contactNumber"));
        if (updates.containsKey("contactDetails")) property.setContactDetails((String) updates.get("contactDetails"));
        if (updates.containsKey("notes")) property.setNotes((String) updates.get("notes"));

        if (updates.containsKey("visited") && updates.get("visited") != null) {
            property.setVisited((Boolean) updates.get("visited"));
        }
        if (updates.containsKey("visitStatus")) property.setVisitStatus((String) updates.get("visitStatus"));
        if (updates.containsKey("visitedAt")) property.setVisitedAt((String) updates.get("visitedAt"));
        if (updates.containsKey("lastVisitedAt")) property.setLastVisitedAt((String) updates.get("lastVisitedAt"));
        if (updates.containsKey("amenities") || updates.containsKey("facilities")) {
            Object am = updates.containsKey("amenities") ? updates.get("amenities") : updates.get("facilities");
            if (am instanceof List<?> list) {
                List<String> strList = new ArrayList<>();
                for (Object o : list) {
                    if (o != null) strList.add(o.toString());
                }
                property.setAmenities(strList);
            } else if (am instanceof String str && !str.trim().isEmpty()) {
                List<String> singleList = new ArrayList<>();
                singleList.add(str.trim());
                property.setAmenities(singleList);
            } else if (am == null) {
                property.setAmenities(new ArrayList<>());
            }
        }

        return propertyRepository.save(property);
    }

    @Transactional
    public void delete(String id) {
        Property property = getById(id);
        propertyRepository.delete(property);
    }
}
