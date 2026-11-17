# RoomTrail Frontend (React 19 + Leaflet + Bootstrap 5)

The responsive web interface for RoomTrail, providing real-time GPS tracking on OpenStreetMap, automatic stop detection, repeated-route warnings, saved rooms management, and historical journey visualization.

## Technologies
- **Framework:** React 19
- **Build Tool:** Vite 8
- **Map Engine:** Leaflet 1.9 + React Leaflet 5 + OpenStreetMap Tiles
- **Styling:** Bootstrap 5.3 + Bootstrap Icons
- **HTTP Client:** Axios with JWT Interceptor

---

## 1. Environment Configuration

The frontend dynamically loads API configuration from environment variables via Vite (`import.meta.env`):

| Variable | Default (Dev) | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:8080/api` | Base URL for Spring Boot backend. In production with reverse proxy, set to `/api`. |

Files:
- `.env.development` - Used during `npm run dev`.
- `.env.production` - Used during `npm run build`.
- `.env.example` - Reference template.

---

## 2. Local Development & Build

### Development Server
```bash
npm install
npm run dev
```
Runs at `http://127.0.0.1:5173/`.

### Production Build
```bash
npm run build
```
Generates minified, production-ready static assets in the `dist/` directory.

---

## 3. Production Deployment

### Option A: Nginx Reverse Proxy (Recommended Single-Origin Architecture)
In this architecture, Nginx serves the React static files and transparently proxies `/api/` calls to the Spring Boot backend on port 8080. This eliminates CORS complexities in production.

Example `/etc/nginx/sites-available/roomtrail`:
```nginx
server {
    listen 80;
    server_name roomtrail.yourdomain.com;

    root /var/www/roomtrail/dist;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # Frontend Single Page Application Routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Reverse Proxy to Spring Boot Backend
    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Option B: Docker Container
Build the image:
```bash
docker build -t roomtrail-frontend:latest .
```
Run container:
```bash
docker run -d --name roomtrail-frontend -p 80:80 roomtrail-frontend:latest
```
