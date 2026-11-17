package com.roomtrail.dto;

public class InspectionItemDto {
    private Long id;
    private String category;
    private String itemKey;
    private String itemLabel;
    private String status; // "GOOD", "NEEDS_ATTENTION", "NOT_AVAILABLE", "UNMARKED"
    private String comment;

    public InspectionItemDto() {}

    public InspectionItemDto(Long id, String category, String itemKey, String itemLabel, String status, String comment) {
        this.id = id;
        this.category = category;
        this.itemKey = itemKey;
        this.itemLabel = itemLabel;
        this.status = status;
        this.comment = comment;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getItemKey() {
        return itemKey;
    }

    public void setItemKey(String itemKey) {
        this.itemKey = itemKey;
    }

    public String getItemLabel() {
        return itemLabel;
    }

    public void setItemLabel(String itemLabel) {
        this.itemLabel = itemLabel;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }
}
