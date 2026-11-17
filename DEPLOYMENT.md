# RoomTrail Production Deployment Guide

This guide provides end-to-end instructions for deploying RoomTrail in production environments.

## Architecture Overview

```
                      +-----------------------------+
                      |       Client Browser        |
                      +--------------+--------------+
                                     |
                                     | HTTP / HTTPS
                                     v
                      +-----------------------------+
                      |      Nginx / CDN (Port 80)  |
                      +--------------+--------------+
                                     |
               +---------------------+---------------------+
               |                                           |
               | Static files (SPA)                        | /api/ (Reverse Proxy)
               v                                           v
+-----------------------------+             +-----------------------------+
|    React Production Build   |             |   Spring Boot 3 (Port 8080) |
|         (dist/)             |             |   Java 21 Virtual Machine   |
+-----------------------------+             +--------------+--------------+
                                                           |
                                                           | JDBC (Port 3306)
                                                           v
                                            +-----------------------------+
                                            |      MySQL 8.x Database     |
                                            +-----------------------------+
```

---

## 1. Prerequisites

- **Java Runtime:** OpenJDK / Eclipse Temurin 21 LTS
- **Node.js:** Node.js 20+ and npm
- **Database:** MySQL Server 8.0+
- **Web Server:** Nginx or Caddy (for production reverse proxy)

---

## 2. Option A: Docker Compose Deployment (Quickest)

Deploy the entire stack (MySQL + Backend + Frontend) with one command:

```bash
docker-compose up -d --build
```

- Web Application: `http://localhost/`
- Backend REST API: `http://localhost:8080/api`
- MySQL Database: `localhost:3306`

To view logs:
```bash
docker-compose logs -f
```

To stop:
```bash
docker-compose down
```

---

## 3. Option B: Manual Host Deployment

### Step 1: Prepare MySQL Database
Log into MySQL and execute:
```sql
CREATE DATABASE IF NOT EXISTS roomtrail CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'roomtrail'@'localhost' IDENTIFIED BY 'YourSecurePasswordHere';
GRANT ALL PRIVILEGES ON roomtrail.* TO 'roomtrail'@'localhost';
FLUSH PRIVILEGES;
```

### Step 2: Build & Deploy Spring Boot Backend
1. Build the production executable JAR:
   ```bash
   cd backend
   ./mvnw clean package -DskipTests
   ```
2. Copy `target/roomtrail-backend-1.0.0.jar` to `/opt/roomtrail/`.
3. Set environment variables and run:
   ```bash
   export PORT=8080
   export DB_HOST=localhost
   export DB_PORT=3306
   export DB_NAME=roomtrail
   export SPRING_DATASOURCE_USERNAME=roomtrail
   export SPRING_DATASOURCE_PASSWORD=YourSecurePasswordHere
   export CORS_ALLOWED_ORIGINS=https://roomtrail.yourdomain.com

   java -jar /opt/roomtrail/roomtrail-backend-1.0.0.jar --spring.profiles.active=prod
   ```

### Step 3: Build & Deploy React Frontend
1. Set production environment variable in `frontend/.env.production`:
   ```properties
   VITE_API_URL=/api
   ```
2. Build the production assets:
   ```bash
   cd frontend
   npm ci
   npm run build
   ```
3. Copy contents of `frontend/dist/` to `/var/www/roomtrail/dist/`.

### Step 4: Configure Nginx Reverse Proxy
Place the following in `/etc/nginx/sites-available/roomtrail`:
```nginx
server {
    listen 80;
    server_name roomtrail.yourdomain.com;

    root /var/www/roomtrail/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Enable the site and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/roomtrail /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 4. Verification Checklist

- [x] Backend responds to `GET /api/properties` with HTTP 200.
- [x] Frontend successfully loads all routes without 404s.
- [x] Leaflet OpenStreetMap tiles load securely over HTTPS.
- [x] Geolocation tracking and stop detection interact seamlessly with MySQL.
- [x] No local URLs hardcoded into client distribution bundle.
