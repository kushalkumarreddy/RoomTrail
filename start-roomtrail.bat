@echo off
title RoomTrail - Smart Travel & Route Tracking
echo ===================================================
echo   RoomTrail - Smart Travel & Route Tracking
echo ===================================================
echo.

:: 1. Verify MySQL Service
sc query MySQL80 2>nul | find "RUNNING" >nul
if errorlevel 1 (
    echo [1/3] Starting MySQL80 Database Service...
    net start MySQL80 >nul 2>&1
) else (
    echo [1/3] MySQL80 Service is already active.
)

:: 2. Verify / Start Spring Boot Backend on Port 8080
netstat -ano | findstr ":8080 " | findstr "LISTENING" >nul
if errorlevel 1 (
    echo [2/3] Starting Spring Boot 3 Backend (Port 8080)...
    start "RoomTrail Backend (Port 8080)" /min java -jar "E:\Using AntiGravity\RoomTrail\backend\target\roomtrail-backend-1.0.0.jar"
    timeout /t 3 /nobreak >nul
) else (
    echo [2/3] Spring Boot Backend is already active on port 8080.
)

:: 3. Verify / Start Vite Frontend on Port 5173
netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul
if errorlevel 1 (
    echo [3/3] Starting React Vite Frontend (Port 5173)...
    cd /d "E:\Using AntiGravity\RoomTrail\frontend"
    start "RoomTrail Frontend (Port 5173)" /min cmd /c "npm run dev"
    timeout /t 2 /nobreak >nul
) else (
    echo [3/3] Frontend is already active on port 5173.
)

echo.
echo Launching RoomTrail in your default browser...
start http://localhost:5173/
echo.
echo RoomTrail is open at: http://localhost:5173/
echo Keep this window or background processes running while using the app.
timeout /t 4 >nul
