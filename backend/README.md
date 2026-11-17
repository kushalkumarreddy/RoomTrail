# RoomTrail Backend (Spring Boot 3 + MySQL)

The backend service for RoomTrail, handling GPS trip persistence, route point indexing, automatic stop detection records, property catalogs, and cross-trip repeated-route queries.

## Technologies
- **Runtime:** Java 21 LTS
- **Framework:** Spring Boot 3.3.5
- **ORM:** Spring Data JPA / Hibernate
- **Database:** MySQL 8.x
- **Security:** Spring Security + Stateless JWT
- **Build Tool:** Apache Maven 3.9+

---

## 1. Environment Configuration

The backend supports full configuration via standard environment variables:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | Web server port |
| `SPRING_DATASOURCE_URL` | `jdbc:mysql://localhost:3306/roomtrail...` | Full MySQL JDBC connection URL |
| `DB_HOST` | `localhost` | Database host (when using structured URL) |
| `DB_PORT` | `3306` | Database port |
| `DB_NAME` | `roomtrail` | Database name |
| `SPRING_DATASOURCE_USERNAME` | `root` | Database username |
| `SPRING_DATASOURCE_PASSWORD` | `root` | Database password |
| `JWT_SECRET` | *(Built-in 256-bit key)* | HMAC-SHA256 signing secret |
| `JWT_EXPIRATION_MS` | `86400000` (24 hours) | JWT token lifespan in milliseconds |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated list of allowed frontend origins |

---

## 2. Local Development & Build

### Compile and Run
```bash
# Using Maven Wrapper or local Maven
./mvnw clean package -DskipTests

# Run the packaged executable JAR
java -jar target/roomtrail-backend-1.0.0.jar
```

### Run with Production Profile
```bash
java -jar target/roomtrail-backend-1.0.0.jar --spring.profiles.active=prod
```

---

## 3. Production Deployment

### Option A: Systemd Service (Linux Server)
Create `/etc/systemd/system/roomtrail-backend.service`:
```ini
[Unit]
Description=RoomTrail Spring Boot Backend
After=syslog.target network.target mysql.service

[Service]
Type=simple
User=roomtrail
ExecStart=/usr/bin/java -jar /opt/roomtrail/roomtrail-backend-1.0.0.jar --spring.profiles.active=prod
Environment="PORT=8080"
Environment="DB_HOST=127.0.0.1"
Environment="DB_PORT=3306"
Environment="DB_NAME=roomtrail"
Environment="SPRING_DATASOURCE_USERNAME=roomtrail_user"
Environment="SPRING_DATASOURCE_PASSWORD=StrongPasswordHere"
Environment="CORS_ALLOWED_ORIGINS=https://roomtrail.yourdomain.com"
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```
Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now roomtrail-backend
```

### Option B: Docker Container
Build the image:
```bash
docker build -t roomtrail-backend:latest .
```
Run the container:
```bash
docker run -d --name roomtrail-backend \
  -p 8080:8080 \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=3306 \
  -e DB_NAME=roomtrail \
  -e SPRING_DATASOURCE_USERNAME=root \
  -e SPRING_DATASOURCE_PASSWORD=your_mysql_password \
  -e CORS_ALLOWED_ORIGINS=https://roomtrail.yourdomain.com \
  roomtrail-backend:latest
```
