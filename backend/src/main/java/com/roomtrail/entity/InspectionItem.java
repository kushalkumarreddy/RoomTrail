package com.roomtrail.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "inspection_items", uniqueConstraints = {
    @UniqueConstraint(name = "uk_inspection_item_key", columnNames = {"inspection_id", "item_key"})
})
public class InspectionItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inspection_id", nullable = false)
    @JsonIgnore
    private RoomInspection inspection;

    @Column(nullable = false, length = 100)
    private String category;

    @Column(name = "item_key", nullable = false, length = 100)
    private String itemKey;

    @Column(name = "item_label", nullable = false, length = 200)
    private String itemLabel;

    @Column(length = 30)
    private String status; // GOOD, NEEDS_ATTENTION, NOT_AVAILABLE, UNMARKED

    @Column(length = 500)
    private String comment;

    public InspectionItem() {}

    public InspectionItem(RoomInspection inspection, String category, String itemKey, String itemLabel, String status, String comment) {
        this.inspection = inspection;
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

    public RoomInspection getInspection() {
        return inspection;
    }

    public void setInspection(RoomInspection inspection) {
        this.inspection = inspection;
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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        InspectionItem that = (InspectionItem) o;
        if (id != null && that.id != null) {
            return id.equals(that.id);
        }
        return itemKey != null && itemKey.equalsIgnoreCase(that.itemKey);
    }

    @Override
    public int hashCode() {
        return itemKey != null ? itemKey.toLowerCase().hashCode() : 0;
    }
}
