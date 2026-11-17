package com.roomtrail.dto;

import java.time.LocalDateTime;

public class RoomInspectionSummaryDto {
    private Long id;
    private String propertyId;
    private String inspectionDate;
    private Integer overallRating;
    private Boolean suitableForRent;
    private int totalItems;
    private int inspectedItems;
    private int completionPercentage;
    private int goodCount;
    private int needsAttentionCount;
    private int notAvailableCount;
    private String remarksSnippet;
    private String concernsSnippet;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public RoomInspectionSummaryDto() {}

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

    public Boolean getSuitableForRent() {
        return suitableForRent;
    }

    public void setSuitableForRent(Boolean suitableForRent) {
        this.suitableForRent = suitableForRent;
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

    public int getCompletionPercentage() {
        return completionPercentage;
    }

    public void setCompletionPercentage(int completionPercentage) {
        this.completionPercentage = completionPercentage;
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

    public String getRemarksSnippet() {
        return remarksSnippet;
    }

    public void setRemarksSnippet(String remarksSnippet) {
        this.remarksSnippet = remarksSnippet;
    }

    public String getConcernsSnippet() {
        return concernsSnippet;
    }

    public void setConcernsSnippet(String concernsSnippet) {
        this.concernsSnippet = concernsSnippet;
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
}
