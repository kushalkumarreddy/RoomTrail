package com.roomtrail.dto;

public class AuthRequest {

    private String username;
    private String email;
    private String password;

    public AuthRequest() {}

    public AuthRequest(String identifier, String password) {
        this.username = identifier;
        this.email = identifier;
        this.password = password;
    }

    public String getUsername() {
        if (username != null && !username.trim().isEmpty()) {
            return username.trim();
        }
        return email != null ? email.trim() : "";
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        if (email != null && !email.trim().isEmpty()) {
            return email.trim();
        }
        return username != null ? username.trim() : "";
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getIdentifier() {
        if (username != null && !username.trim().isEmpty()) {
            return username.trim();
        }
        if (email != null && !email.trim().isEmpty()) {
            return email.trim();
        }
        return "";
    }
}
