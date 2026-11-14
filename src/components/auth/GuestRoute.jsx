import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../common/LoadingSpinner';

const GuestRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner fullPage text="Checking session..." />;
  }

  if (isAuthenticated) {
    const origin = location.state?.from?.pathname || '/';
    return <Navigate to={origin} replace />;
  }

  return children;
};

export default GuestRoute;
