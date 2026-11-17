import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import GuestRoute from './components/auth/GuestRoute';

// RoomTrail Application Pages
import LandingPage from './pages/landing/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import SavedPlacesPage from './pages/places/SavedPlacesPage';
import AddEditPlacePage from './pages/places/AddEditPlacePage';
import MapExplorerPage from './pages/map/MapExplorerPage';
import LiveTrackingPage from './pages/tracking/LiveTrackingPage';
import MyTripsPage from './pages/trips/MyTripsPage';
import VisitHistoryPage from './pages/history/VisitHistoryPage';
import TravelHistoryPage from './pages/history/TravelHistoryPage';
import TravelHistoryMapPage from './pages/history/TravelHistoryMapPage';
import TripSummaryPage from './pages/trips/TripSummaryPage';
import ProfilePage from './pages/profile/ProfilePage';
import NotFoundPage from './pages/common/NotFoundPage';

// Smart root redirector based on authenticated user role
const RootRedirector = () => {
  const { isAdmin } = useAuth();
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  return <DashboardPage />;
};

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
              {/* 1. Dashboard (Role-aware root redirect) */}
              <Route path="/" element={<RootRedirector />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Administrator Portal Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminDashboardPage defaultTab="overview" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminDashboardPage defaultTab="users" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/platform"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminDashboardPage defaultTab="platform" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/profile"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminDashboardPage defaultTab="profile" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/rooms"
                element={<Navigate to="/admin/platform" replace />}
              />
              <Route
                path="/admin/trips"
                element={<Navigate to="/admin/platform" replace />}
              />

              {/* 2. Live Tracking */}
              <Route path="/live-tracking" element={<LiveTrackingPage />} />
              <Route path="/tracking" element={<Navigate to="/live-tracking" replace />} />

              {/* 3. Saved Rooms */}
              <Route path="/rooms" element={<SavedPlacesPage />} />
              <Route path="/places" element={<Navigate to="/rooms" replace />} />
              <Route path="/saved-places" element={<Navigate to="/rooms" replace />} />
              <Route path="/destinations" element={<Navigate to="/rooms" replace />} />
              <Route path="/rooms/new" element={<AddEditPlacePage />} />
              <Route path="/places/new" element={<AddEditPlacePage />} />
              <Route path="/rooms/edit/:id" element={<AddEditPlacePage />} />
              <Route path="/places/edit/:id" element={<AddEditPlacePage />} />

              {/* 4. Travel History */}
              <Route path="/history" element={<TravelHistoryPage />} />
              <Route path="/visits" element={<VisitHistoryPage />} />
              <Route path="/travel-history-map" element={<TravelHistoryMapPage />} />

              {/* Auxiliary / Utility Pages */}
              <Route path="/map-explorer" element={<MapExplorerPage />} />
              <Route path="/trips" element={<MyTripsPage />} />
              <Route path="/trip-summary" element={<TripSummaryPage />} />
              <Route path="/trips/:id/summary" element={<TripSummaryPage />} />
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
