package com.roomtrail.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "room_inspections", indexes = {
    @Index(name = "idx_inspection_prop_user", columnList = "property_id, user_id"),
    @Index(name = "idx_inspection_user", columnList = "user_id")
})
public class RoomInspection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "property_id", nullable = false, length = 64)
    private String propertyId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "inspection_date", nullable = false, length = 20)
    private String inspectionDate;

    @Column(name = "overall_rating")
    private Integer overallRating;

    @Column(name = "overall_remarks", columnDefinition = "TEXT")
    private String overallRemarks;

    @Column(name = "suitable_for_rent")
    private Boolean suitableForRent;

    @Column(name = "additional_concerns", columnDefinition = "TEXT")
    private String additionalConcerns;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    @OneToMany(mappedBy = "inspection", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("id ASC")
    private List<InspectionItem> items = new ArrayList<>();

    public RoomInspection() {}

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void addItem(InspectionItem item) {
        items.add(item);
        item.setInspection(this);
    }

    public void removeItem(InspectionItem item) {
        items.remove(item);
        item.setInspection(null);
    }

    public void clearItems() {
        for (InspectionItem item : new ArrayList<>(items)) {
            removeItem(item);
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(String propertyId) {
        this.propertyId = propertyId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getInspectionDate() {
        return inspectionDate;
    }

    public void setInspectionDate(String inspectionDate) {
        this.inspectionDate = inspectionDate;
    }

    public Integer getOverallRating() {
        return overallRating;
    }

    public void setOverallRating(Integer overallRating) {
        this.overallRating = overallRating;
    }

    public String getOverallRemarks() {
        return overallRemarks;
    }

    public void setOverallRemarks(String overallRemarks) {
        this.overallRemarks = overallRemarks;
    }

    public Boolean getSuitableForRent() {
        return suitableForRent;
    }

    public void setSuitableForRent(Boolean suitableForRent) {
        this.suitableForRent = suitableForRent;
    }

    public String getAdditionalConcerns() {
        return additionalConcerns;
    }

    public void setAdditionalConcerns(String additionalConcerns) {
        this.additionalConcerns = additionalConcerns;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public List<InspectionItem> getItems() {
        return items;
    }

    public void setItems(List<InspectionItem> items) {
        this.items = items;
    }
}
