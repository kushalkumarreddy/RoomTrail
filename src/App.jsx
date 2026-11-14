import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import GuestRoute from './components/auth/GuestRoute';

// RoomTrail Application Pages
import LandingPage from './pages/landing/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import SavedPlacesPage from './pages/places/SavedPlacesPage';
import AddEditPlacePage from './pages/places/AddEditPlacePage';
import MapExplorerPage from './pages/map/MapExplorerPage';
import LiveTrackingPage from './pages/tracking/LiveTrackingPage';
import MyTripsPage from './pages/trips/MyTripsPage';
import VisitHistoryPage from './pages/history/VisitHistoryPage';
import TravelHistoryMapPage from './pages/history/TravelHistoryMapPage';
import TripSummaryPage from './pages/trips/TripSummaryPage';
import ProfilePage from './pages/profile/ProfilePage';
import NotFoundPage from './pages/common/NotFoundPage';

function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <AuthProvider>
          <Routes>
            {/* 1. Public Landing Page */}
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/welcome" element={<LandingPage />} />

            {/* 2 & 3. Authentication Pages */}
            <Route
              path="/login"
              element={
                <GuestRoute>
                  <LoginPage />
                </GuestRoute>
              }
            />
            <Route
              path="/register"
              element={
                <GuestRoute>
                  <RegisterPage />
                </GuestRoute>
              }
            />

            {/* 4 to 12. Authenticated Application Shell */}
            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              {/* 4. Dashboard */}
              <Route path="/" element={<DashboardPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* 5. Saved Places */}
              <Route path="/places" element={<SavedPlacesPage />} />
              <Route path="/destinations" element={<Navigate to="/places" replace />} />

              {/* 6. Add/Edit Place */}
              <Route path="/places/new" element={<AddEditPlacePage />} />
              <Route path="/places/edit/:id" element={<AddEditPlacePage />} />

              {/* 7. Map Explorer */}
              <Route path="/map-explorer" element={<MapExplorerPage />} />
              <Route path="/map" element={<Navigate to="/map-explorer" replace />} />

              {/* 8. Live Tracking */}
              <Route path="/live-tracking" element={<LiveTrackingPage />} />

              {/* 9. My Trips */}
              <Route path="/trips" element={<MyTripsPage />} />

              {/* 10. Visit History */}
              <Route path="/history" element={<VisitHistoryPage />} />

              {/* Dedicated Travel History Map (Features 3, 4 & 5) */}
              <Route path="/travel-history-map" element={<TravelHistoryMapPage />} />

              {/* 11. Trip Summary */}
              <Route path="/trip-summary" element={<TripSummaryPage />} />
              <Route path="/trips/:id/summary" element={<TripSummaryPage />} />

              {/* 12. User Profile */}
              <Route path="/profile" element={<ProfilePage />} />
            </Route>

            {/* 404 Catch-All */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  );
}

export default App;
