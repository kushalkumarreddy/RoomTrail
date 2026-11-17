package com.roomtrail.dto;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class RoomInspectionResponseDto {
    private Long id;
    private String propertyId;
    private String propertyName;
    private String propertyAddress;
    private Long userId;
    private String inspectionDate;
    private Integer overallRating;
    private String overallRemarks;
    private Boolean suitableForRent;
    private String additionalConcerns;
    private int totalItems;
    private int inspectedItems;
    private int goodCount;
    private int needsAttentionCount;
    private int notAvailableCount;
    private int completionPercentage;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<InspectionItemDto> items = new ArrayList<>();

    public RoomInspectionResponseDto() {}

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

    public String getPropertyName() {
        return propertyName;
    }

    public void setPropertyName(String propertyName) {
        this.propertyName = propertyName;
    }

    public String getPropertyAddress() {
        return propertyAddress;
    }

    public void setPropertyAddress(String propertyAddress) {
        this.propertyAddress = propertyAddress;
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

    public int getTotalItems() {
        return totalItems;
    }

    public void setTotalItems(int totalItems) {
        this.totalItems = totalItems;
    }

    public int getInspectedItems() {
        return inspectedItems;
    }

    public void setInspectedItems(int inspectedItems) {
        this.inspectedItems = inspectedItems;
    }

    public int getInspectedCount() {
        return inspectedItems;
    }

    public void setInspectedCount(int inspectedCount) {
        this.inspectedItems = inspectedCount;
    }

    public int getGoodCount() {
        return goodCount;
    }

    public void setGoodCount(int goodCount) {
        this.goodCount = goodCount;
    }

    public int getNeedsAttentionCount() {
        return needsAttentionCount;
    }

    public void setNeedsAttentionCount(int needsAttentionCount) {
        this.needsAttentionCount = needsAttentionCount;
    }

    public int getNotAvailableCount() {
        return notAvailableCount;
    }

    public void setNotAvailableCount(int notAvailableCount) {
        this.notAvailableCount = notAvailableCount;
    }

    public int getCompletionPercentage() {
        return completionPercentage;
    }

    public void setCompletionPercentage(int completionPercentage) {
        this.completionPercentage = completionPercentage;
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

    public List<InspectionItemDto> getItems() {
        return items;
    }

    public void setItems(List<InspectionItemDto> items) {
        this.items = items;
    }
}
