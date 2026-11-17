# RoomTrail - Smart GPS Room-Search and Travel Tracking

RoomTrail is a focused, GPS-based room-search and travel tracking web application designed for people exploring cities to find PGs, rental rooms, or flats.

During the search, people often forget which places they visited, re-travel roads they've already covered, and lose track of room details and rents. RoomTrail solves this by recording journeys in real time, detecting repeated routes to prevent wasted effort, and automatically saving locations whenever a user stops for more than five minutes.

---

## Key Features

1. **Live GPS Tracking**: Real-time position tracking on standard OpenStreetMap street tiles with actual chronological purple polyline visualization.
2. **Automatic Stop Detection**: Detects stationary stops (> 5 minutes within 30m radius), auto-geocodes street addresses via Nominatim, and logs locations without interrupting travel.
3. **Repeated-Route Detection & Alerts**: Continuously compares active GPS vectors against previously travelled road segments in MySQL to warn against duplicate routes.
4. **Saved Rooms (`/rooms`)**: Comprehensive catalog of auto-saved and manual room locations with rent, contact, notes, and interactive Leaflet map preview.
5. **Travel History (`/history`)**: Chronological archive of previous journeys with distance, duration, visit counts, and historical GPS path visualization.

---

## Architecture

- **Frontend**: React 19, Bootstrap 5.3, Leaflet 1.9, Axios, Vite 8.
- **Backend**: Java 21 LTS, Spring Boot 3.3.5, Spring Data JPA, Hibernate, Spring Security, JJWT.
- **Database**: MySQL 8.0.

```
RoomTrail/
  frontend/          # React 19 SPA
    src/
      components/    # Reusable UI components
      pages/         # Dashboard, LiveTracking, SavedPlaces, TravelHistory
      services/      # Axios API integration with Spring Boot
      styles/        # Clean Bootstrap 5 styling
      utils/         # Distance and route matching algorithms
  backend/           # Spring Boot 3 REST Application
    src/main/java/
      com/roomtrail/
        controller/  # REST API endpoints
        service/     # Core business logic
        repository/  # Spring Data JPA repositories
        entity/      # MySQL JPA entities (Properties, Trips, Visits, RoutePoints)
        config/      # Security, CORS, and Data initialization
    src/main/resources/
      application.properties
      application-prod.properties
```

---

## Getting Started

### Prerequisites
- Java 21 LTS
- Node.js 20+
- MySQL 8.0+

### Quick Start with Docker
```bash
docker-compose up -d --build
```
Access the application at `http://localhost/`.

### Manual Local Development

1. **Start MySQL Database**: Ensure MySQL is running on port 3306 with database `roomtrail`.
2. **Start Backend**:
   ```bash
   cd backend
   mvn clean package -DskipTests
   java -jar target/roomtrail-backend-1.0.0.jar
   ```
   Backend starts on `http://localhost:8080/`.
3. **Start Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Frontend starts on `http://127.0.0.1:5173/`.

---

## Documentation
- [REST API Specification](backend/API_DOCUMENTATION.md)
- [Production Deployment Guide](DEPLOYMENT.md)
- [Backend Documentation](backend/README.md)
- [Frontend Documentation](frontend/README.md)
