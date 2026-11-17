package com.roomtrail.dto;

import java.time.LocalDateTime;

public class AdminUserSummaryDto {
    private Long id;
    private String accountRef;
    private String role;
    private String status;
    private LocalDateTime registeredAt;
    private long totalRooms;
    private long totalTrips;

    public AdminUserSummaryDto() {}

    public AdminUserSummaryDto(Long id, String accountRef, String role, String status, LocalDateTime registeredAt, long totalRooms, long totalTrips) {
        this.id = id;
        this.accountRef = accountRef;
        this.role = role;
        this.status = status;
        this.registeredAt = registeredAt;
        this.totalRooms = totalRooms;
        this.totalTrips = totalTrips;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getAccountRef() {
        return accountRef;
    }

    public void setAccountRef(String accountRef) {
        this.accountRef = accountRef;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getRegisteredAt() {
        return registeredAt;
    }

    public void setRegisteredAt(LocalDateTime registeredAt) {
        this.registeredAt = registeredAt;
    }

    public long getTotalRooms() {
        return totalRooms;
    }

    public void setTotalRooms(long totalRooms) {
        this.totalRooms = totalRooms;
    }

    public long getTotalTrips() {
        return totalTrips;
    }

    public void setTotalTrips(long totalTrips) {
        this.totalTrips = totalTrips;
    }
}
