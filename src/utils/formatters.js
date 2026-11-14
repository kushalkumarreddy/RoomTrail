/**
 * Utility functions for formatting dates, coordinates, distances, and statuses
 */

export const formatDate = (dateString, options = {}) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options,
    }).format(date);
  } catch {
    return dateString;
  }
};

export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  return formatDate(dateString, {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatCoordinates = (lat, lng) => {
  if (lat === undefined || lat === null || lng === undefined || lng === null) {
    return 'Not specified';
  }
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (isNaN(latNum) || isNaN(lngNum)) return 'Invalid coordinates';
  return `${latNum.toFixed(4)}°, ${lngNum.toFixed(4)}°`;
};

export const formatDistance = (meters) => {
  if (meters === undefined || meters === null || isNaN(meters)) return '0 m';
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
};

/**
 * Calculate accurate distance in meters between two coordinates using Haversine formula
 */
export const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  if (
    lat1 === undefined ||
    lat1 === null ||
    lon1 === undefined ||
    lon1 === null ||
    lat2 === undefined ||
    lat2 === null ||
    lon2 === undefined ||
    lon2 === null
  ) {
    return 0;
  }

  const numLat1 = Number(lat1);
  const numLon1 = Number(lon1);
  const numLat2 = Number(lat2);
  const numLon2 = Number(lon2);

  if (isNaN(numLat1) || isNaN(numLon1) || isNaN(numLat2) || isNaN(numLon2)) {
    return 0;
  }

  const R = 6371e3; // Earth radius in meters
  const phi1 = (numLat1 * Math.PI) / 180;
  const phi2 = (numLat2 * Math.PI) / 180;
  const deltaPhi = ((numLat2 - numLat1) * Math.PI) / 180;
  const deltaLambda = ((numLon2 - numLon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
};

/**
 * Format elapsed seconds to HH:MM:SS
 */
export const formatDurationSeconds = (totalSeconds) => {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (num) => String(num).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

/**
 * Calculate total path distance in meters from an array of coordinates
 */
export const calculateTotalPathDistance = (points = []) => {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const lat1 = prev.lat ?? prev.latitude;
    const lon1 = prev.lng ?? prev.longitude;
    const lat2 = curr.lat ?? curr.latitude;
    const lon2 = curr.lng ?? curr.longitude;
    total += calculateDistanceMeters(lat1, lon1, lat2, lon2);
  }
  return total;
};

export const getCategoryIcon = (category) => {
  switch (category?.toLowerCase()) {
    case 'pg':
      return 'bi-building';
    case 'flat':
      return 'bi-houses';
    case 'room':
      return 'bi-door-open';
    case 'house':
      return 'bi-house-heart';
    case 'restaurant':
    case 'cafe':
      return 'bi-cup-hot';
    case 'shopping':
    case 'shop':
    case 'mall':
      return 'bi-bag-check';
    case 'hospital':
    case 'clinic':
      return 'bi-hospital';
    case 'office':
      return 'bi-briefcase';
    case 'tourist':
    case 'tourist place':
    case 'travel':
    case 'scenic':
    case 'attraction':
      return 'bi-compass';
    default:
      return 'bi-pin-map';
  }
};
