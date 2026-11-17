# RoomTrail REST API Specification

**Version:** 1.0.0  
**Base URL:** `http://localhost:8080/api` (Development) or `/api` (Production)  
**Authentication:** Bearer JWT Token (`Authorization: Bearer <token>`)

---

## 1. Authentication Endpoints (`/api/auth`)

### 1.1 Register User
- **Method:** `POST /api/auth/register`
- **Request Body:**
  ```json
  {
    "username": "traveler1",
    "email": "traveler1@example.com",
    "password": "Password123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOi...",
    "type": "Bearer",
    "id": "1",
    "username": "traveler1",
    "email": "traveler1@example.com"
  }
  ```

### 1.2 User Login
- **Method:** `POST /api/auth/login`
- **Request Body:**
  ```json
  {
    "usernameOrEmail": "traveler1",
    "password": "Password123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOi...",
    "type": "Bearer",
    "id": "1",
    "username": "traveler1",
    "email": "traveler1@example.com"
  }
  ```

### 1.3 Get Current User Profile
- **Method:** `GET /api/auth/me`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):** User entity.

---

## 2. Properties / Saved Rooms Endpoints (`/api/properties`)

### 2.1 Get All Properties
- **Method:** `GET /api/properties`
- **Query Parameters:** Optional filtering
- **Response (200 OK):** List of Property objects.
  ```json
  [
    {
      "id": "1794670887249",
      "userId": "1",
      "name": "Unknown Location",
      "category": "room",
      "address": "5, Phase 3, KPHB Colony, 500072",
      "city": "Hyderabad, Telangana",
      "latitude": 17.493825,
      "longitude": 78.39682,
      "rent": "8,000",
      "contactPhone": "9876543210",
      "contactNumber": "9876543210",
      "notes": "1 RK single room with attached bath",
      "visited": true,
      "visitStatus": "visited",
      "createdAt": "2026-11-14T15:41:27.249"
    }
  ]
  ```

### 2.2 Get Property by ID
- **Method:** `GET /api/properties/{id}`
- **Response (200 OK):** Property object.

### 2.3 Create Property (e.g. from Auto-Stop Detection or Manual Add)
- **Method:** `POST /api/properties`
- **Request Body:**
  ```json
  {
    "name": "Greenview 2BHK Apartment",
    "category": "flat",
    "address": "100 Feet Rd, HAL 2nd Stage, Indiranagar",
    "city": "Bengaluru",
    "latitude": 12.9716,
    "longitude": 77.6412,
    "rent": "₹32,000 / mo",
    "contactNumber": "+91 98765 43210",
    "notes": "Water included, 3 months deposit.",
    "visited": true
  }
  ```
- **Response (200 OK):** Created Property object.

### 2.4 Update Property
- **Method:** `PUT /api/properties/{id}` or `PATCH /api/properties/{id}`
- **Request Body:** Partial or complete Property object.
- **Response (200 OK):** Updated Property object.

### 2.5 Delete Property
- **Method:** `DELETE /api/properties/{id}`
- **Response (204 No Content)**

---

## 3. Trips Endpoints (`/api/trips`)

### 3.1 Get All Trips
- **Method:** `GET /api/trips`
- **Response (200 OK):** List of Trip objects.
  ```json
  [
    {
      "id": "1794670127442",
      "userId": "1",
      "tripName": "Live Tracking Journey",
      "startLocation": "Home Base",
      "startLatitude": 12.9716,
      "startLongitude": 77.5946,
      "endLocation": "Indiranagar Central",
      "endLatitude": 12.9784,
      "endLongitude": 77.6408,
      "startTime": "2026-11-14T15:28:47.442Z",
      "endTime": "2026-11-14T15:30:22.381Z",
      "status": "completed",
      "totalDistance": "471 m",
      "totalDuration": "00:01:24"
    }
  ]
  ```

### 3.2 Create / Start Trip
- **Method:** `POST /api/trips`
- **Request Body:**
  ```json
  {
    "tripName": "Room Hunting Expedition",
    "startLatitude": 17.4921,
    "startLongitude": 78.3944,
    "status": "active",
    "startTime": "2026-11-14T16:00:00Z"
  }
  ```
- **Response (200 OK):** Created Trip object with generated ID.

### 3.3 Complete / Update Trip
- **Method:** `PUT /api/trips/{id}` or `PATCH /api/trips/{id}`
- **Request Body:**
  ```json
  {
    "endLatitude": 17.4965,
    "endLongitude": 78.3985,
    "endTime": "2026-11-14T16:45:00Z",
    "totalDistance": "3.4 km",
    "totalDuration": "45 mins",
    "status": "completed"
  }
  ```
- **Response (200 OK):** Updated Trip object.

### 3.4 Delete Trip
- **Method:** `DELETE /api/trips/{id}`
- **Response (204 No Content)**

---

## 4. Route Points Endpoints (`/api/routePoints` or `/api/route-points`)

### 4.1 Get Route Points for a Trip
- **Method:** `GET /api/routePoints?tripId={tripId}`
- **Response (200 OK):** Chronologically sorted GPS route points (`sequenceNumber` ascending).
  ```json
  [
    {
      "id": "1794670156845",
      "tripId": "1794670127442",
      "latitude": 17.49268,
      "longitude": 78.39513,
      "accuracy": 6.0,
      "speed": 8.5,
      "heading": 90.0,
      "timestamp": "2026-11-14T15:29:16.843Z",
      "sequenceNumber": 1
    }
  ]
  ```

### 4.2 Get Previous Routes for Repeated-Route Detection
- **Method:** `GET /api/routePoints?excludeTripId={currentTripId}`
- **Response (200 OK):** All points from previously recorded historical trips to check against new GPS readings.

### 4.3 Save Route Point
- **Method:** `POST /api/routePoints`
- **Request Body:**
  ```json
  {
    "tripId": "1794670127442",
    "latitude": 17.49338,
    "longitude": 78.39573,
    "accuracy": 5.0,
    "speed": 7.2,
    "timestamp": "2026-11-14T15:29:17.944Z",
    "sequenceNumber": 2
  }
  ```
- **Response (200 OK):** Persisted RoutePoint record.

---

## 5. Visits Endpoints (`/api/visits`)

### 5.1 Get Visits
- **Method:** `GET /api/visits`
- **Query Parameters:** `?propertyId={id}` or `?tripId={id}`
- **Response (200 OK):** List of confirmed visits.

### 5.2 Record a Visit
- **Method:** `POST /api/visits`
- **Request Body:**
  ```json
  {
    "propertyId": "1794670887249",
    "tripId": "1794670127442",
    "arrivalTime": "2026-11-14T15:41:27.249Z",
    "latitude": 17.493825,
    "longitude": 78.39682,
    "notes": "Visited during evening search"
  }
  ```
- **Response (200 OK):** Created Visit entity.

---

## 6. Reverse Geocoding Proxy (`/api/geocode`)

### 6.1 Reverse Geocode Coordinate
- **Method:** `GET /api/geocode/reverse?lat=17.493825&lon=78.39682`
- **Response (200 OK):** Structured address components (place name, road, suburb, city).
