package com.roomtrail.service;

import com.roomtrail.entity.Visit;
import com.roomtrail.exception.ResourceNotFoundException;
import com.roomtrail.repository.VisitRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class VisitService {

    private final VisitRepository visitRepository;

    public VisitService(VisitRepository visitRepository) {
        this.visitRepository = visitRepository;
    }

    public List<Visit> getAll(Long userId, String tripId) {
        if (tripId != null && !tripId.trim().isEmpty()) {
            if (userId != null) {
                return visitRepository.findByTripIdAndUserId(tripId.trim(), userId);
            }
            return visitRepository.findByTripId(tripId.trim());
        } else if (userId != null) {
            return visitRepository.findByUserId(userId);
        }
        return visitRepository.findAll();
    }

    public Visit getById(String id) {
        return visitRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Visit record not found with id: " + id));
    }

    @Transactional
    public Visit create(Visit visit, Long userId) {
        if (userId != null) {
            visit.setUserId(userId);
        }
        if (visit.getId() == null || visit.getId().trim().isEmpty()) {
            visit.setId(String.valueOf(System.currentTimeMillis()));
        }
        if (visit.getDestinationId() == null && visit.getPropertyId() != null) {
            visit.setDestinationId(visit.getPropertyId());
        } else if (visit.getPropertyId() == null && visit.getDestinationId() != null) {
            visit.setPropertyId(visit.getDestinationId());
        }

        if (visit.getDestinationId() != null) {
            List<Visit> pastVisits = visitRepository.findByDestinationId(visit.getDestinationId());
            if (pastVisits != null && !pastVisits.isEmpty()) {
                if (visit.getVisitNumber() == null || visit.getVisitNumber() <= 1) {
                    visit.setVisitNumber(pastVisits.size() + 1);
                }
                visit.setIsRevisit(true);
            } else if (visit.getVisitNumber() == null) {
                visit.setVisitNumber(1);
            }
        } else if (visit.getVisitNumber() == null) {
            visit.setVisitNumber(1);
        }

        return visitRepository.save(visit);
    }

    @Transactional
    public void delete(String id) {
        Visit visit = getById(id);
        visitRepository.delete(visit);
    }
}
