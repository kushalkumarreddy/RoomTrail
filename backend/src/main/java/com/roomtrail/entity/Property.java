package com.roomtrail.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "properties")
public class Property {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "user_id")
    private Long userId = 1L;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 50)
    private String category = "flat";

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(length = 100)
    private String city = "Bengaluru";

    private Double latitude;
    private Double longitude;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 30)
    private String priority = "medium";

    @Column(length = 60)
    private String rent;

    @Column(length = 60)
    private String price;

    @Column(name = "contact_person", length = 100)
    private String contactPerson;

    @Column(name = "contact_phone", length = 40)
    private String contactPhone;

    @Column(name = "contact_number", length = 40)
    private String contactNumber;

    @Column(name = "contact_details", length = 200)
    private String contactDetails;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(nullable = false)
    private Boolean visited = false;

    @Column(name = "visit_status", length = 50)
    private String visitStatus = "pending";

    @Column(name = "visited_at")
    private String visitedAt;

    @Column(name = "last_visited_at")
    private String lastVisitedAt;

    @Column(name = "created_date")
    private String createdDate;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "property_amenities", joinColumns = @JoinColumn(name = "property_id"))
    @Column(name = "amenity")
    private List<String> amenities = new ArrayList<>();

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    public Property() {}

    @PrePersist
    protected void onCreate() {
        if (id == null || id.trim().isEmpty()) {
            id = String.valueOf(System.currentTimeMillis());
        }
        if (userId == null) userId = 1L;
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
        if (createdDate == null) createdDate = LocalDateTime.now().toString();
        if (contactNumber == null && contactPhone != null) contactNumber = contactPhone;
        if (contactPhone == null && contactNumber != null) contactPhone = contactNumber;
        if (lastVisitedAt == null && visitedAt != null) lastVisitedAt = visitedAt;
        if (visitedAt == null && lastVisitedAt != null) visitedAt = lastVisitedAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
        if (contactNumber == null && contactPhone != null) contactNumber = contactPhone;
        if (contactPhone == null && contactNumber != null) contactPhone = contactNumber;
        if (lastVisitedAt == null && visitedAt != null) lastVisitedAt = visitedAt;
        if (visitedAt == null && lastVisitedAt != null) visitedAt = lastVisitedAt;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() {
        return userId != null ? String.valueOf(userId) : "1";
    }

    public void setUserId(Object userId) {
        if (userId instanceof Number) {
            this.userId = ((Number) userId).longValue();
        } else if (userId instanceof String && !((String) userId).trim().isEmpty()) {
            try {
                this.userId = Long.parseLong(((String) userId).trim());
            } catch (NumberFormatException e) {
                this.userId = 1L;
            }
        } else {
            this.userId = 1L;
        }
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getRent() { return rent; }
    public void setRent(String rent) { this.rent = rent; }

    public String getPrice() { return price; }
    public void setPrice(String price) { this.price = price; }

    public String getContactPerson() { return contactPerson; }
    public void setContactPerson(String contactPerson) { this.contactPerson = contactPerson; }

    public String getContactPhone() { return contactPhone != null ? contactPhone : contactNumber; }
    public void setContactPhone(String contactPhone) {
        this.contactPhone = contactPhone;
        if (this.contactNumber == null) this.contactNumber = contactPhone;
    }

    public String getContactNumber() { return contactNumber != null ? contactNumber : contactPhone; }
    public void setContactNumber(String contactNumber) {
        this.contactNumber = contactNumber;
        if (this.contactPhone == null) this.contactPhone = contactNumber;
        if (this.contactDetails == null) this.contactDetails = contactNumber;
    }

    public String getContactDetails() { return contactDetails; }
    public void setContactDetails(String contactDetails) { this.contactDetails = contactDetails; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Boolean getVisited() { return visited; }
    public void setVisited(Boolean visited) { this.visited = visited; }

    public String getVisitStatus() { return visitStatus; }
    public void setVisitStatus(String visitStatus) { this.visitStatus = visitStatus; }

    public String getVisitedAt() { return visitedAt != null ? visitedAt : lastVisitedAt; }
    public void setVisitedAt(String visitedAt) {
        this.visitedAt = visitedAt;
        if (this.lastVisitedAt == null) this.lastVisitedAt = visitedAt;
    }

    public String getLastVisitedAt() { return lastVisitedAt != null ? lastVisitedAt : visitedAt; }
    public void setLastVisitedAt(String lastVisitedAt) {
        this.lastVisitedAt = lastVisitedAt;
        if (this.visitedAt == null) this.visitedAt = lastVisitedAt;
    }

    public String getCreatedDate() { return createdDate; }
    public void setCreatedDate(String createdDate) { this.createdDate = createdDate; }

    public List<String> getAmenities() { return amenities; }
    public void setAmenities(List<String> amenities) { this.amenities = amenities != null ? amenities : new ArrayList<>(); }

    public List<String> getFacilities() { return amenities; }
    public void setFacilities(List<String> facilities) { this.amenities = facilities != null ? facilities : new ArrayList<>(); }

    public String getDestinationId() { return id; }
    public void setDestinationId(String destinationId) { if (this.id == null) this.id = destinationId; }

    public String getStatus() { return visitStatus; }
    public void setStatus(String status) { this.visitStatus = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
