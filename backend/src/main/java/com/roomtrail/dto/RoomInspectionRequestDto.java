package com.roomtrail.dto;

import java.util.ArrayList;
import java.util.List;

public class RoomInspectionRequestDto {
    private String inspectionDate;
    private Integer overallRating;
    private String overallRemarks;
    private Boolean suitableForRent;
    private String additionalConcerns;
    private List<InspectionItemDto> items = new ArrayList<>();

    public RoomInspectionRequestDto() {}

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

    public List<InspectionItemDto> getItems() {
        return items;
    }

    public void setItems(List<InspectionItemDto> items) {
        this.items = items;
    }
}
