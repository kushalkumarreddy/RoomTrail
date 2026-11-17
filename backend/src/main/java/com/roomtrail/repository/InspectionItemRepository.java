package com.roomtrail.repository;

import com.roomtrail.entity.InspectionItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InspectionItemRepository extends JpaRepository<InspectionItem, Long> {

    List<InspectionItem> findByInspectionId(Long inspectionId);

    void deleteByInspectionId(Long inspectionId);
}
