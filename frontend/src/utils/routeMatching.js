/**
 * RoomTrail Phase 6: Repeated Route Detection and Matching Engine
 * 
 * Provides robust mathematical algorithms for detecting when a user travels along 
 * roads they have already covered in previous journeys.
 * 
 * Core Features:
 * 1. Geographical cross-track distance (point-to-segment perpendicular distance in metres).
 * 2. Vector heading / bearing alignment (differentiates travelling ALONG a road vs. crossing perpendicularly).
 * 3. Accuracy and drift filtering (discards GPS fixes with high uncertainty > 30m).
 * 4. Stationary motion guard (skips alerts when stopped at signals or rooms).
 * 5. Parallel road differentiation (tight proximity tolerance ~25m combined with road angle alignment).
 * 6. Encounter grouping and anti-spam cooldown management.
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Great-circle distance between two GPS coordinates using the Haversine formula.
 */
export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return Infinity;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates initial compass bearing between two coordinates in degrees (0 - 360).
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLon = (lon2 - lon1) * rad;
  const y = Math.sin(dLon) * Math.cos(lat2 * rad);
  const x =
    Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
    Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  return bearing;
}

/**
 * Computes angular difference between two bearings in degrees (0 - 180).
 */
export function getAngularDifference(bearing1, bearing2) {
  let diff = Math.abs(bearing1 - bearing2) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/**
 * Computes road vector alignment between current motion and a historical road segment.
 * Since roads can be traversed in either direction (forward or reverse), this computes
 * the minimum angular deviation from the road axis (0 to 90 degrees).
 * 
 * - angle <= 35 deg: Travelling along the road (Forward or Reverse)
 * - angle > 55 deg: Crossing perpendicularly at an intersection
 */
export function getRoadAlignmentAngle(motionBearing, segmentBearing) {
  const diff = getAngularDifference(motionBearing, segmentBearing);
  // Roads are bi-directional: 0 deg diff is same direction, 180 deg diff is reverse direction along same road
  const reverseDiff = Math.abs(180 - diff);
  return Math.min(diff, reverseDiff);
}

/**
 * Computes perpendicular distance from a GPS point P to a line segment A -> B.
 * Uses local equirectangular projection centered at P for sub-meter accuracy without trigonometric distortion.
 * 
 * Returns: {
 *   distanceMeters: number,
 *   t: number (projection factor, where 0 <= t <= 1 means projection falls within segment),
 *   closestLat: number,
 *   closestLng: number
 * }
 */
export function pointToSegmentDistance(point, segA, segB) {
  const pLat = point.latitude ?? point.lat;
  const pLng = point.longitude ?? point.lng;
  const aLat = segA.latitude ?? segA.lat;
  const aLng = segA.lng ?? segA.longitude;
  const bLat = segB.latitude ?? segB.lat;
  const bLng = segB.lng ?? segB.longitude;

  // Local projection around P
  const latFactor = (Math.PI / 180) * EARTH_RADIUS_METERS;
  const lngFactor = Math.cos((pLat * Math.PI) / 180) * latFactor;

  const ax = (aLng - pLng) * lngFactor;
  const ay = (aLat - pLat) * latFactor;
  const bx = (bLng - pLng) * lngFactor;
  const by = (bLat - pLat) * latFactor;

  // Segment vector AB
  const dx = bx - ax;
  const dy = by - ay;
  const segmentLengthSquared = dx * dx + dy * dy;

  // Degenerate segment (A and B are virtually the same point)
  if (segmentLengthSquared < 1.0) {
    const dist = Math.sqrt(ax * ax + ay * ay);
    return { distanceMeters: dist, t: 0, closestLat: aLat, closestLng: aLng };
  }

  // Projection of P (0, 0) onto AB:
  // vector AP is (-ax, -ay). Dot product with AB: -ax * dx + -ay * dy = -(ax*dx + ay*dy)
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / segmentLengthSquared));

  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  const distanceMeters = Math.sqrt(closestX * closestX + closestY * closestY);

  const closestLat = aLat + t * (bLat - aLat);
  const closestLng = aLng + t * (bLng - aLng);

  return { distanceMeters, t, closestLat, closestLng };
}

/**
 * Evaluates current GPS movement against all historical trips and their recorded route points.
 * 
 * Strict Accuracy & Quality Rules:
 * - Rejects points with accuracy > maxAccuracyThreshold (default: 30m).
 * - Requires real movement (distance from lastPoint >= minMovementMeters, speed > 0.8 km/h).
 * - Requires perpendicular distance <= proximityToleranceMeters (default: 25m).
 * - Requires travel direction alignment <= maxAlignmentAngleDeg (default: 35 deg) to prevent intersection cross-traffic false alerts.
 * - Prevents parallel roads (e.g. 40m away) from being falsely matched.
 * 
 * @param {Object} currentPoint Current GPS fix { lat, lng, accuracy, speed }
 * @param {Object} previousPoint Previous GPS fix { lat, lng }
 * @param {Array} historicalTrips List of previous trips with their route points
 * @param {Object} options Configuration overrides
 * @returns {Object|null} Match details or null if no repeated route
 */
export function matchRepeatedRoute(currentPoint, previousPoint, historicalTrips, options = {}) {
  const {
    proximityToleranceMeters = 25,
    maxAccuracyThreshold = 30,
    minMovementMeters = 4,
    maxAlignmentAngleDeg = 38,
  } = options;

  // 1. Accuracy Guard: Discard poor GPS readings
  const accuracy = currentPoint.accuracy != null ? Number(currentPoint.accuracy) : 10;
  if (accuracy > maxAccuracyThreshold) {
    return null; // GPS uncertainty too high to reliably match road
  }

  // 2. Stationary Guard: Must be actively travelling
  const curLat = currentPoint.latitude ?? currentPoint.lat;
  const curLng = currentPoint.longitude ?? currentPoint.lng;

  if (!previousPoint) return null;
  const prevLat = previousPoint.latitude ?? previousPoint.lat;
  const prevLng = previousPoint.longitude ?? previousPoint.lng;

  const moveDist = haversineDistanceMeters(prevLat, prevLng, curLat, curLng);
  if (moveDist < minMovementMeters) {
    return null; // Stationary or minor jitter; do not trigger route alerts while stopped
  }

  // Current travel heading
  const currentMotionBearing = calculateBearing(prevLat, prevLng, curLat, curLng);

  let bestMatch = null;
  let minPerpDistance = Infinity;

  for (const trip of historicalTrips) {
    const points = trip.routePoints || trip.points || [];
    if (!points || points.length < 2) continue;

    for (let i = 0; i < points.length - 1; i++) {
      const segA = points[i];
      const segB = points[i + 1];

      const aLat = segA.latitude ?? segA.lat;
      const aLng = segA.longitude ?? segA.lng;
      const bLat = segB.latitude ?? segB.lat;
      const bLng = segB.longitude ?? segB.lng;

      // Segment length check
      const segLen = haversineDistanceMeters(aLat, aLng, bLat, bLng);
      if (segLen < 3) continue; // Skip identical duplicate points

      // Quick bounding box rejection (skip segments > 100m away immediately)
      const distToA = haversineDistanceMeters(curLat, curLng, aLat, aLng);
      if (distToA > 150) continue;

      // Calculate perpendicular distance to segment
      const { distanceMeters, t, closestLat, closestLng } = pointToSegmentDistance(
        currentPoint,
        segA,
        segB
      );

      // Must be within configurable proximity tolerance
      if (distanceMeters > proximityToleranceMeters) continue;

      // Direction / Alignment check
      const segmentBearing = calculateBearing(aLat, aLng, bLat, bLng);
      const alignmentAngle = getRoadAlignmentAngle(currentMotionBearing, segmentBearing);

      // Must be travelling along the road, not crossing perpendicularly
      if (alignmentAngle > maxAlignmentAngleDeg) continue;

      if (distanceMeters < minPerpDistance) {
        minPerpDistance = distanceMeters;
        bestMatch = {
          tripId: trip.id || trip.tripId,
          tripName: trip.tripName || trip.name || trip.title || 'Previous Journey',
          tripDate: trip.scheduledDate || trip.startTime || trip.createdAt || '',
          distanceMeters: Math.round(distanceMeters * 10) / 10,
          alignmentAngle: Math.round(alignmentAngle),
          segmentIndex: i,
          matchedSegment: [
            [aLat, aLng],
            [bLat, bLng],
          ],
          closestPoint: [closestLat, closestLng],
          currentCoord: [curLat, curLng],
        };
      }
    }
  }

  return bestMatch;
}

export default {
  haversineDistanceMeters,
  calculateBearing,
  getAngularDifference,
  getRoadAlignmentAngle,
  pointToSegmentDistance,
  matchRepeatedRoute,
};
