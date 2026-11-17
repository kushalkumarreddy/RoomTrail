package com.roomtrail.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "admin_audit_logs")
public class AdminAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "admin_reference", length = 50, nullable = false)
    private String adminReference;

    @Column(name = "action_performed", length = 50, nullable = false)
    private String actionPerformed;

    @Column(name = "target_account_reference", length = 50, nullable = false)
    private String targetAccountReference;

    @Column(name = "timestamp", nullable = false)
    private LocalDateTime timestamp = LocalDateTime.now();

    @Column(name = "action_result", length = 30, nullable = false)
    private String actionResult;

    @Column(name = "details", length = 255)
    private String details;

    public AdminAuditLog() {}

    public AdminAuditLog(String adminReference, String actionPerformed, String targetAccountReference, String actionResult, String details) {
        this.adminReference = adminReference;
        this.actionPerformed = actionPerformed;
        this.targetAccountReference = targetAccountReference;
        this.actionResult = actionResult;
        this.details = details;
        this.timestamp = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getAdminReference() {
        return adminReference;
    }

    public void setAdminReference(String adminReference) {
        this.adminReference = adminReference;
    }

    public String getActionPerformed() {
        return actionPerformed;
    }

    public void setActionPerformed(String actionPerformed) {
        this.actionPerformed = actionPerformed;
    }

    public String getTargetAccountReference() {
        return targetAccountReference;
    }

    public void setTargetAccountReference(String targetAccountReference) {
        this.targetAccountReference = targetAccountReference;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public String getActionResult() {
        return actionResult;
    }

    public void setActionResult(String actionResult) {
        this.actionResult = actionResult;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }
}
