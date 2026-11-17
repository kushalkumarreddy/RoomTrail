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

/**
 * Evaluates whether an array of GPS route points represents an authentic, detailed
 * recorded route following roads and turns, as opposed to missing data, 0 points,
 * or 2-3 artificial/endpoint-only straight line coordinates.
 */
export const hasSufficientGpsRoute = (points = []) => {
  if (!points || !Array.isArray(points)) return false;
  const validPoints = points.filter(
    (pt) => pt && (pt.latitude || pt.lat) != null && (pt.longitude || pt.lng) != null
  );

  // Less than 2 points cannot form any path
  if (validPoints.length < 2) return false;

  // Exactly 2 points: if distance between them is > 100m, they are only endpoints, not a detailed breadcrumb route
  if (validPoints.length === 2) {
    const p1 = validPoints[0];
    const p2 = validPoints[1];
    const d = calculateDistanceMeters(
      p1.latitude ?? p1.lat, p1.longitude ?? p1.lng,
      p2.latitude ?? p2.lat, p2.longitude ?? p2.lng
    );
    return d <= 100;
  }

  // 3 points: if any consecutive leg is > 500m or total path > 1 km with only 3 points,
  // this is an artificial straight-line placeholder (e.g. start, midpoint, end), not a recorded street breadcrumb path.
  if (validPoints.length === 3) {
    for (let i = 1; i < validPoints.length; i++) {
      const legDist = calculateDistanceMeters(
        validPoints[i - 1].latitude ?? validPoints[i - 1].lat,
        validPoints[i - 1].longitude ?? validPoints[i - 1].lng,
        validPoints[i].latitude ?? validPoints[i].lat,
        validPoints[i].longitude ?? validPoints[i].lng
      );
      if (legDist > 500) return false;
    }
  }

  // If points exist and are sufficiently detailed (4+ points or continuous short intervals)
  return true;
};

/**
 * Calculate forward azimuth/bearing in degrees (0 - 360) from coord 1 to coord 2
 */
export const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const phi1 = (Number(lat1) * Math.PI) / 180;
  const phi2 = (Number(lat2) * Math.PI) / 180;
  const deltaLambda = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return (theta * 180 / Math.PI + 360) % 360;
};

/**
 * Builds contiguous Leaflet coordinate segments from ordered GPS route points.
 * Preserves separate legs across pauses and recording gaps, avoiding artificial
 * straight lines connecting the paused gap.
 * Returns an array of segment arrays: [ [ [lat1, lng1], [lat2, lng2] ], [ ... ] ]
 */
export const buildRouteSegments = (points = []) => {
  if (!points || !Array.isArray(points)) return [];

  const valid = [...points]
    .filter((pt) => pt && (pt.latitude || pt.lat) != null && (pt.longitude || pt.lng) != null)
    .sort((a, b) => {
      const seqA = a.sequenceNumber != null ? a.sequenceNumber : 0;
      const seqB = b.sequenceNumber != null ? b.sequenceNumber : 0;
      if (seqA !== seqB) return seqA - seqB;
      const timeA = new Date(a.recordedAt || a.timestamp || 0).getTime();
      const timeB = new Date(b.recordedAt || b.timestamp || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });

  if (valid.length === 0) return [];

  const segments = [];
  let currentSegment = [];

  for (let i = 0; i < valid.length; i++) {
    const pt = valid[i];
    const lat = Number(pt.latitude ?? pt.lat);
    const lng = Number(pt.longitude ?? pt.lng);
    const coord = [lat, lng];

    if (currentSegment.length === 0) {
      currentSegment.push(coord);
      continue;
    }

    const prevPt = valid[i - 1];
    const prevLat = Number(prevPt.latitude ?? prevPt.lat);
    const prevLng = Number(prevPt.longitude ?? prevPt.lng);

    // Segment break detection:
    // 1. Explicit segmentIndex change (from pause/resume)
    const hasDifferentSegmentIndex =
      pt.segmentIndex != null &&
      prevPt.segmentIndex != null &&
      pt.segmentIndex !== prevPt.segmentIndex;

    // 2. Large temporal gap (> 180 seconds) or physical jump (> 300m)
    const timeA = new Date(prevPt.recordedAt || prevPt.timestamp || 0).getTime();
    const timeB = new Date(pt.recordedAt || pt.timestamp || 0).getTime();
    const timeGapSec = Math.abs(timeB - timeA) / 1000;
    const distMeters = calculateDistanceMeters(prevLat, prevLng, lat, lng);
    const isUnconnectedGap = timeGapSec > 180 && distMeters > 300;

    if (hasDifferentSegmentIndex || isUnconnectedGap) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }
      currentSegment = [coord];
    } else {
      currentSegment.push(coord);
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
};


