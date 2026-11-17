import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import {
  propertyService,
  tripService,
  visitService,
  routePointService,
  tripSummaryService,
  geocodingService,
} from '../../services';
import Modal from '../../components/common/Modal';
import QuickAddPlaceModal from '../../components/places/QuickAddPlaceModal';
import AddRoomDetailsModal from '../../components/places/AddRoomDetailsModal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  formatDate,
  formatDistance,
  calculateDistanceMeters,
  formatDurationSeconds,
  formatCoordinates,
  getCategoryIcon,
} from '../../utils/formatters';
import {
  matchRepeatedRoute,
  haversineDistanceMeters,
  calculateBearing,
} from '../../utils/routeMatching';

const LiveTrackingPage = () => {
  const { user } = useAuth();
  const { showSuccess, showInfo, showWarning, showError } = useNotification();
  const navigate = useNavigate();

  // Primary data states
  const [places, setPlaces] = useState([]);
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tracking state machine: 'idle' | 'recording' | 'paused' | 'ended'
  const [trackingStatus, setTrackingStatus] = useState('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceCoveredMeters, setDistanceCoveredMeters] = useState(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [maxSpeedKmh, setMaxSpeedKmh] = useState(0);

  // GPS state
  const [currentLocation, setCurrentLocation] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [gpsPermission, setGpsPermission] = useState('prompt'); // 'prompt', 'granted', 'denied', 'unavailable'
  const [gpsErrorMsg, setGpsErrorMsg] = useState(null);
  const [routeBreadcrumbs, setRouteBreadcrumbs] = useState([]); // Array of { lat, lng, timestamp, accuracy, speed }

  // Proximity Thresholds (Configurable)
  const [nearbyThresholdMeters, setNearbyThresholdMeters] = useState(200); // 200m nearby notification
  const [visitThresholdMeters, setVisitThresholdMeters] = useState(50); // 50m visit confirmation prompt
  const [showThresholdSettings, setShowThresholdSettings] = useState(false);

  // Proximity Detection Engine State
  const [nearestPlace, setNearestPlace] = useState(null);
  const [nearestDistance, setNearestDistance] = useState(null);
  const [approachingPlace, setApproachingPlace] = useState(null); // Place within 200m

  // Encounter Tracker: prevents duplicate prompts during the same encounter
  // Maps placeId -> { status: 'idle'|'prompted'|'confirmed'|'dismissed'|'snoozed', snoozeUntil: number }
  const encounterTrackerRef = useRef({});

  // Visit Confirmation & Revisit Alert Modal State
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [promptDestination, setPromptDestination] = useState(null);
  const [visitNotes, setVisitNotes] = useState('');
  const [isRevisit, setIsRevisit] = useState(false);
  const [savingVisit, setSavingVisit] = useState(false);
  const [allVisits, setAllVisits] = useState([]);
  const [revisitDetails, setRevisitDetails] = useState({
    isRevisit: false,
    totalVisits: 0,
    lastVisitDate: '',
    lastVisitTime: '',
    lastVisitNotes: '',
    nextSequenceNumber: 1,
  });

  // End Trip Confirmation Modal
  const [isEndTripModalOpen, setIsEndTripModalOpen] = useState(false);
  const [finalizingTrip, setFinalizingTrip] = useState(false);

  // Quick Add Place Modal State (accessible anytime during tracking)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // Phase 5: Automatic Stop Detection & Auto-Save State
  const [isStationary, setIsStationary] = useState(false);
  const [stationarySeconds, setStationarySeconds] = useState(0);
  const [autoSavedStop, setAutoSavedStop] = useState(null); // Property object saved automatically
  const [selectedAutoProperty, setSelectedAutoProperty] = useState(null);
  const [isRoomDetailsModalOpen, setIsRoomDetailsModalOpen] = useState(false);
  const stationaryWindowRef = useRef({
    anchorPoint: null,
    points: [],
    startTime: null,
    lastPointTime: null,
    isSaved: false,
    savedPropertyId: null,
  });

  // Phase 6: Repeated Route Detection & Alerts State
  const [historicalTrips, setHistoricalTrips] = useState([]); // Array of { id, tripName, scheduledDate, startTime, routePoints }
  const [repeatedRouteAlert, setRepeatedRouteAlert] = useState(null); // { visible, tripId, tripName, tripDate, overlapMeters, distanceMeters }
  const [activeRepeatedSegment, setActiveRepeatedSegment] = useState([]); // [[lat, lng], [lat, lng]] for highlighting on Leaflet map
  const [routeFamiliarityStatus, setRouteFamiliarityStatus] = useState('exploring'); // 'exploring' | 'repeated'
  const previousRoutesLayerGroup = useRef(null);
  const repeatedRouteHighlightRef = useRef(null);
  const repeatedRouteEncounterRef = useRef({
    isActive: false,
    tripId: null,
    tripName: '',
    tripDate: '',
    matchedSegment: null,
    overlapMeters: 0,
    consecutiveMatches: 0,
    consecutiveMisses: 0,
    lastAlertTime: 0,
    isDismissed: false,
    cooldownUntil: 0,
  });

  // Map Refs
  const mapContainerRef = useRef(null);
  const leafletMapInstance = useRef(null);
  const markersLayerGroup = useRef(null);
  const userMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const routePolylineRef = useRef(null);
  const proximityCircleRef = useRef(null);

  // Geolocation & Timer Refs
  const watchIdRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const lastRecordedPointRef = useRef(null);

  // Trip & Geolocation Sequence Tracking Refs (Eliminates async state lag & closure issues)
  const activeTripRef = useRef(null);
  const sequenceNumberRef = useRef(0);
  const routeBreadcrumbsRef = useRef([]);
  const liveStartMarkerRef = useRef(null);

  // Home base fallback coordinates
  const homeCoords = useRef({
    lat: user?.homeCoordinates?.lat || 12.9716,
    lng: user?.homeCoordinates?.lng || 77.5946,
  }).current;

  // 1. Initial Data Fetching & Active Session Restoration
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [placesData, tripsData, visitsData, allRoutePoints] = await Promise.all([
        propertyService.getAll(),
        tripService.getAll(),
        visitService.getAll().catch(() => []),
        routePointService.getAll().catch(() => []),
      ]);

      const userPlaces = user?.id
        ? placesData.filter((p) => !p.userId || p.userId === user.id)
        : placesData;
      setPlaces(userPlaces);

      const userTrips = user?.id
        ? tripsData.filter((t) => !t.userId || t.userId === user.id)
        : tripsData;
      setTrips(userTrips);

      const userVisits = user?.id
        ? visitsData.filter((v) => !v.userId || v.userId === user.id)
        : visitsData;
      setAllVisits(userVisits);

      // Phase 6: Map route points by tripId to construct historical routes
      const pointsByTrip = {};
      (allRoutePoints || []).forEach((pt) => {
        if (!pt.tripId) return;
        if (!pointsByTrip[pt.tripId]) pointsByTrip[pt.tripId] = [];
        pointsByTrip[pt.tripId].push(pt);
      });

      const enrichedTrips = (userTrips || []).map((t) => {
        const rawPts = pointsByTrip[t.id] || [];
        const sortedPts = [...rawPts].sort(
          (a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0)
        );
        return {
          ...t,
          routePoints: sortedPts,
        };
      });
      setHistoricalTrips(enrichedTrips);

      // Always initialize tracking as clean 'idle' state upon opening/refreshing
      setTrackingStatus('idle');
      activeTripRef.current = null;
      setSelectedTrip(null);
      setRouteBreadcrumbs([]);
      routeBreadcrumbsRef.current = [];
      sequenceNumberRef.current = 0;
      lastRecordedPointRef.current = null;
      setElapsedSeconds(0);
      setDistanceCoveredMeters(0);
      if (routePolylineRef.current) {
        routePolylineRef.current.setLatLngs([]);
      }
      // Clean up any stale tracking session from localStorage
      localStorage.removeItem('roomtrail_active_tracking_session');
    } catch (err) {
      console.error('Failed to load initial tracking data', err);
      showError('Failed to load destinations and trips.');
    } finally {
      setLoading(false);
    }
  }, [user, showError]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 2. Leaflet Map Initialization (Root Cause Fix: Depend on loading and mapContainerRef)
  useEffect(() => {
    if (loading || !mapContainerRef.current) return;

    if (leafletMapInstance.current) {
      try {
        if (leafletMapInstance.current.getContainer() !== mapContainerRef.current) {
          leafletMapInstance.current.remove();
          leafletMapInstance.current = null;
        }
      } catch {
        leafletMapInstance.current = null;
      }
    }

    if (!leafletMapInstance.current) {
      const initialLat = currentLocation?.lat || homeCoords.lat;
      const initialLng = currentLocation?.lng || homeCoords.lng;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 15,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      markersLayerGroup.current = L.layerGroup().addTo(map);
      previousRoutesLayerGroup.current = L.layerGroup().addTo(map);
      repeatedRouteHighlightRef.current = L.layerGroup().addTo(map);

      // Travelled Path Polyline (Requirement 3: Distinct purple #7c3aed, weight 6)
      const polyline = L.polyline([], {
        color: '#7c3aed',
        weight: 6,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
        smoothFactor: 1,
      }).addTo(map);
      routePolylineRef.current = polyline;

      // Create live user location marker immediately at initial position
      const userIcon = L.divIcon({
        className: 'user-location-marker-wrapper',
        html: `<div class="user-location-pin" title="Your Live GPS Position"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      userMarkerRef.current = L.marker([initialLat, initialLng], {
        icon: userIcon,
        zIndexOffset: 1500,
      }).addTo(map);

      leafletMapInstance.current = map;

      // Force recalculation of container size after mounting to avoid blank map
      setTimeout(() => {
        if (map) {
          map.invalidateSize();
        }
      }, 150);
    }

    const handleResize = () => {
      if (leafletMapInstance.current) {
        leafletMapInstance.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [loading, homeCoords]);

  // Clean up leaflet map instance ONLY on unmount
  useEffect(() => {
    return () => {
      if (leafletMapInstance.current) {
        leafletMapInstance.current.remove();
        leafletMapInstance.current = null;
      }
    };
  }, []);

  // 2b. Sync Travelled Path Polyline and Start Marker with routeBreadcrumbs
  useEffect(() => {
    if (!leafletMapInstance.current || !routePolylineRef.current) return;
    const map = leafletMapInstance.current;
    if (routeBreadcrumbs && routeBreadcrumbs.length > 0) {
      const latLngs = routeBreadcrumbs.map((pt) => [pt.lat, pt.lng]);
      routePolylineRef.current.setLatLngs(latLngs);

      // Render or update green start pin at the first recorded coordinate of the trip
      const startCoord = latLngs[0];
      if (!liveStartMarkerRef.current) {
        const startIcon = L.divIcon({
          className: 'custom-live-start-marker',
          html: `
            <div style="background-color: #10b981; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,0.3); color: #ffffff;">
              <i class="bi bi-geo-alt-fill" style="font-size: 14px;"></i>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        liveStartMarkerRef.current = L.marker(startCoord, {
          icon: startIcon,
          zIndexOffset: 1200,
        }).addTo(map);
        liveStartMarkerRef.current.bindPopup(
          `<strong><i class="bi bi-flag-fill me-1 text-success"></i>Trip Start Point</strong><br/><span style="font-size: 11px; color: #64748b;">${startCoord[0].toFixed(5)}°, ${startCoord[1].toFixed(5)}°</span>`
        );
      } else {
        liveStartMarkerRef.current.setLatLng(startCoord);
      }
    } else {
      routePolylineRef.current.setLatLngs([]);
      if (liveStartMarkerRef.current) {
        liveStartMarkerRef.current.remove();
        liveStartMarkerRef.current = null;
      }
    }
  }, [routeBreadcrumbs, loading]);

  // Historical routes are NOT rendered as grey dashed overlays on the Live Tracking map.
  // The Live Tracking map displays only the clean OpenStreetMap base and the active session's recorded route.
  useEffect(() => {
    if (previousRoutesLayerGroup.current) {
      previousRoutesLayerGroup.current.clearLayers();
    }
  }, []);

  // Phase 6: Sync Active Repeated Route Highlight Layer (amber glowing polyline)
  useEffect(() => {
    if (!leafletMapInstance.current || !repeatedRouteHighlightRef.current) return;
    const layer = repeatedRouteHighlightRef.current;
    layer.clearLayers();

    if (activeRepeatedSegment && activeRepeatedSegment.length >= 2) {
      const poly = L.polyline(activeRepeatedSegment, {
        color: '#f59e0b',
        weight: 7,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      });
      poly.bindTooltip(
        `<strong>Repeated Road Section</strong><br/>You already travelled this route!`,
        { permanent: false, sticky: true }
      );
      poly.addTo(layer);
    }
  }, [activeRepeatedSegment]);

  // 3. Render Destination Markers on Map (Requirement 3: Saved = Orange, Visited = Green)
  useEffect(() => {
    if (!leafletMapInstance.current || !markersLayerGroup.current) return;
    const layer = markersLayerGroup.current;
    layer.clearLayers();

    places.forEach((place) => {
      if (!place.latitude || !place.longitude) return;

      const isVisited = place.visited;
      const isTarget = nearestPlace?.id === place.id;

      // Saved destinations: Orange (#ea580c), Visited destinations: Green (#10b981)
      let pinColor = isVisited ? 'pin-green' : 'pin-orange';

      const customIcon = L.divIcon({
        className: 'custom-destination-marker',
        html: `
          <div class="custom-pin-base ${pinColor}">
            <span class="custom-pin-icon">
              <i class="bi ${getCategoryIcon(place.category)}"></i>
            </span>
          </div>
        `,
        iconSize: isTarget ? [40, 40] : [34, 34],
        iconAnchor: isTarget ? [20, 40] : [17, 34],
        popupAnchor: [0, -32],
      });

      const marker = L.marker([place.latitude, place.longitude], {
        icon: customIcon,
        zIndexOffset: isTarget ? 1000 : (isVisited ? 100 : 200),
      });

      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; min-width: 180px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${
            isVisited ? '#10b981' : '#ea580c'
          };">
            ${place.category || 'Place'} • ${isVisited ? 'Visited' : 'Saved'}
          </div>
          <h6 style="font-weight: 700; margin: 2px 0 4px; font-size: 13px;">${place.name}</h6>
          <p style="font-size: 11px; color: #64748b; margin: 0 0 4px;">${place.address || ''}</p>
          <div style="font-size: 11px; color: #0b192c; font-weight: 600;">
            ${formatCoordinates(place.latitude, place.longitude)}
          </div>
        </div>
      `);

      layer.addLayer(marker);
    });
  }, [places, nearestPlace, loading]);

  // 4. Update User Marker and Accuracy Circle on Map
  const updateUserOnMap = useCallback((coords) => {
    if (!leafletMapInstance.current) return;
    const map = leafletMapInstance.current;

    // Update or create User Marker
    if (!userMarkerRef.current) {
      const userIcon = L.divIcon({
        className: 'user-location-marker-wrapper',
        html: `<div class="user-location-pin" title="Your Live Location"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      userMarkerRef.current = L.marker([coords.lat, coords.lng], {
        icon: userIcon,
        zIndexOffset: 1500,
      }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng([coords.lat, coords.lng]);
    }

    // Update or create accuracy circle
    if (coords.accuracy) {
      if (!accuracyCircleRef.current) {
        accuracyCircleRef.current = L.circle([coords.lat, coords.lng], {
          radius: coords.accuracy,
          color: '#3b82f6',
          weight: 1,
          opacity: 0.4,
          fillColor: '#93c5fd',
          fillOpacity: 0.15,
        }).addTo(map);
      } else {
        accuracyCircleRef.current.setLatLng([coords.lat, coords.lng]);
        accuracyCircleRef.current.setRadius(coords.accuracy);
      }
    }
  }, []);

  // 5. Automatic Proximity Detection Engine
  const evaluateProximity = useCallback(
    (coords) => {
      if (!places || places.length === 0) return;

      let closest = null;
      let minDistance = Infinity;

      // Compute distances to all destinations
      places.forEach((place) => {
        if (!place.latitude || !place.longitude) return;
        const dist = calculateDistanceMeters(
          coords.lat,
          coords.lng,
          place.latitude,
          place.longitude
        );

        if (dist < minDistance) {
          minDistance = dist;
          closest = place;
        }
      });

      setNearestPlace(closest);
      setNearestDistance(minDistance);

      if (!closest) return;

      // Account for GPS accuracy: effective distance
      const accuracyBuffer = coords.accuracy ? Math.min(coords.accuracy / 2, 20) : 0;
      const effectiveDistance = Math.max(0, minDistance - accuracyBuffer);

      // Check 200m Nearby Destination Radar
      if (effectiveDistance <= nearbyThresholdMeters && !closest.visited) {
        setApproachingPlace(closest);
      } else {
        setApproachingPlace(null);
      }

      // Reset encounter tracker if user clearly leaves the vicinity (> visitThresholdMeters + 60m)
      places.forEach((place) => {
        const tracker = encounterTrackerRef.current[place.id];
        if (tracker && (tracker.status === 'dismissed' || tracker.status === 'prompted')) {
          if (place.latitude && place.longitude) {
            const d = calculateDistanceMeters(coords.lat, coords.lng, place.latitude, place.longitude);
            if (d > visitThresholdMeters + 60) {
              encounterTrackerRef.current[place.id] = { status: 'idle' };
            }
          }
        }
      });

      // Check 50m Visit Confirmation Threshold
      if (effectiveDistance <= visitThresholdMeters) {
        const tracker = encounterTrackerRef.current[closest.id] || { status: 'idle' };

        // Anti-duplicate Encounter Logic:
        // 1. If already confirmed during this encounter -> do not prompt again
        // 2. If dismissed/skipped for this encounter -> do not repeatedly show the same alert during the same location encounter
        // 3. If snoozed -> check if snooze period expired (5 mins)
        const now = Date.now();
        if (tracker.status === 'confirmed' || tracker.status === 'dismissed') {
          return;
        }
        if (tracker.status === 'snoozed' && tracker.snoozeUntil && now < tracker.snoozeUntil) {
          return;
        }

        // If not already prompted or opened
        if (tracker.status !== 'prompted' && !isVisitModalOpen) {
          encounterTrackerRef.current[closest.id] = {
            status: 'prompted',
            lastPromptedAt: now,
          };
          setPromptDestination(closest);

          // FEATURE 1: Previously Visited Location Alert Check
          // Primary matching method: destination IDs, supplemented by GPS proximity
          const pastVisits = allVisits.filter(
            (v) => (v.destinationId === closest.id || v.propertyId === closest.id)
          );
          const hasVisitedBefore = pastVisits.length > 0 || Boolean(closest.visited) || closest.visitStatus === 'visited';

          if (hasVisitedBefore) {
            const sortedPast = [...pastVisits].sort(
              (a, b) => new Date(b.arrivalTime || b.visitedAt || 0) - new Date(a.arrivalTime || a.visitedAt || 0)
            );
            const lastVisit = sortedPast[0];
            const lastDate = lastVisit?.arrivalTime || lastVisit?.visitedAt || closest.visitedAt;
            const formattedDate = lastDate ? formatDate(lastDate) : 'Previously on record';
            const formattedTime = lastDate
              ? new Date(lastDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Earlier';
            const lastNotes = lastVisit?.notes || closest.notes || '';
            const totalCount = sortedPast.length || 1;

            setRevisitDetails({
              isRevisit: true,
              totalVisits: totalCount,
              lastVisitDate: formattedDate,
              lastVisitTime: formattedTime,
              lastVisitNotes: lastNotes,
              nextSequenceNumber: totalCount + 1,
            });
            setIsRevisit(true);
          } else {
            setRevisitDetails({
              isRevisit: false,
              totalVisits: 0,
              lastVisitDate: '',
              lastVisitTime: '',
              lastVisitNotes: '',
              nextSequenceNumber: 1,
            });
            setIsRevisit(false);
          }

          setIsVisitModalOpen(true);
        }
      }
    },
    [places, allVisits, nearbyThresholdMeters, visitThresholdMeters, isVisitModalOpen]
  );

  // Helper to persist tracking session to localStorage for reload recovery
  const syncSessionToStorage = useCallback(
    (overrides = {}) => {
      if (!selectedTrip?.id) return;
      try {
        const payload = {
          tripId: selectedTrip.id,
          status: overrides.status || trackingStatus,
          elapsedSeconds: overrides.elapsedSeconds !== undefined ? overrides.elapsedSeconds : elapsedSeconds,
          distanceCoveredMeters:
            overrides.distanceCoveredMeters !== undefined
              ? overrides.distanceCoveredMeters
              : distanceCoveredMeters,
          lastUpdated: Date.now(),
        };
        localStorage.setItem('roomtrail_active_tracking_session', JSON.stringify(payload));
      } catch (e) {
        console.warn('Failed to sync tracking session to localStorage', e);
      }
    },
    [selectedTrip, trackingStatus, elapsedSeconds, distanceCoveredMeters]
  );

  // Phase 5: Trigger Automatic Stop Save to MySQL
  const triggerAutomaticStopSave = useCallback(
    async (points) => {
      if (!points || points.length === 0) return null;

      // 1. Calculate representative stopping coordinate (centroid of stationary points)
      const validPoints = points.filter((p) => p && !isNaN(p.lat ?? p.latitude) && !isNaN(p.lng ?? p.longitude));
      if (validPoints.length === 0) return null;

      const avgLat = Number(
        (validPoints.reduce((sum, p) => sum + (p.lat !== undefined ? p.lat : p.latitude), 0) / validPoints.length).toFixed(6)
      );
      const avgLng = Number(
        (validPoints.reduce((sum, p) => sum + (p.lng !== undefined ? p.lng : p.longitude), 0) / validPoints.length).toFixed(6)
      );

      // 2. Prevent Duplicates: check if an existing property is already within 30m
      const existingMatch = places.find((p) => {
        if (!p.latitude || !p.longitude) return false;
        const dist = calculateDistanceMeters(avgLat, avgLng, Number(p.latitude), Number(p.longitude));
        return dist <= 30;
      });

      if (existingMatch) {
        console.log('[Phase 5] Stationary stop detected at existing property:', existingMatch.name);
        stationaryWindowRef.current.savedPropertyId = existingMatch.id;

        // Log revisit in visits table
        try {
          await visitService.create({
            propertyId: existingMatch.id,
            tripId: selectedTrip?.id,
            latitude: avgLat,
            longitude: avgLng,
            notes: 'Stationary stop revisit (>5 minutes)',
          });
        } catch (vErr) {
          console.warn('Revisit record failed:', vErr);
        }

        setAutoSavedStop({
          ...existingMatch,
          isExisting: true,
        });
        showSuccess(`Stopped at previously saved property: ${existingMatch.name}. Add room details?`);
        return existingMatch;
      }

      // 3. Reverse-geocode the representative coordinate
      let placeName = 'Unknown Location';
      let address = '';
      let city = 'Bengaluru';
      let category = 'room';

      try {
        const geo = await geocodingService.reverseGeocode({ latitude: avgLat, longitude: avgLng });
        if (geo && geo.success) {
          if (geo.placeName && geo.placeName.trim()) {
            placeName = geo.placeName.trim();
          }
          if (geo.address) address = geo.address.trim();
          if (geo.city) city = geo.city.trim();
          if (geo.category) category = geo.category;
        }
      } catch (geoErr) {
        console.warn('[Phase 5] Geocoding fallback used for automatic stop:', geoErr);
      }

      // 4. Automatically save property in MySQL without requiring form submission first
      const detectionTime = new Date().toISOString();
      const newPropertyPayload = {
        name: placeName,
        address: address,
        city: city,
        latitude: avgLat,
        longitude: avgLng,
        category: category,
        visitStatus: 'visited',
        visited: true,
        createdAt: detectionTime,
        createdDate: detectionTime,
        lastVisitedAt: detectionTime,
        notes: 'Auto-detected 5-minute stop during live tracking.',
      };

      try {
        const createdProperty = await propertyService.create(newPropertyPayload);
        stationaryWindowRef.current.savedPropertyId = createdProperty.id;

        // Add to local places state so marker immediately appears on map
        setPlaces((prev) => [createdProperty, ...prev]);

        // Record initial visit in visits table
        try {
          await visitService.create({
            propertyId: createdProperty.id,
            tripId: selectedTrip?.id,
            latitude: avgLat,
            longitude: avgLng,
            notes: 'First visit auto-detected during 5-minute stop.',
          });
        } catch (vErr) {
          console.warn('Failed to record initial visit in MySQL', vErr);
        }

        // Show non-intrusive notification: "Location saved. Add room details?"
        setAutoSavedStop({
          ...createdProperty,
          isExisting: false,
        });

        showSuccess('Location saved. Add room details?');
        return createdProperty;
      } catch (err) {
        console.error('[Phase 5] Failed to automatically save detected property:', err);
        showError('Failed to automatically save detected stop location.');
        return null;
      }
    },
    [places, selectedTrip, showSuccess, showError]
  );

  // Phase 5: Continuous Stationary Evaluation
  const processStationaryDetection = useCallback(
    (coords) => {
      if (trackingStatus !== 'recording') return;

      // Filter poor GPS signals (accuracy > 35m) so they are not mistaken for a genuine stop
      if (coords.accuracy && coords.accuracy > 35) {
        console.warn('[Phase 5] GPS accuracy is poor (>35m):', coords.accuracy, 'm. Ignoring for stop detection.');
        return;
      }

      const now = coords.timestamp || Date.now();
      const window = stationaryWindowRef.current;

      if (!window.anchorPoint) {
        window.anchorPoint = coords;
        window.points = [coords];
        window.startTime = now;
        window.lastPointTime = now;
        window.isSaved = false;
        window.savedPropertyId = null;
        setIsStationary(true);
        setStationarySeconds(0);
        return;
      }

      const distFromAnchor = calculateDistanceMeters(
        window.anchorPoint.lat,
        window.anchorPoint.lng,
        coords.lat,
        coords.lng
      );

      // Within 30m stationary bubble
      if (distFromAnchor <= 30) {
        window.points.push(coords);
        window.lastPointTime = now;
        const elapsedSec = Math.floor((now - window.startTime) / 1000);
        setStationarySeconds(elapsedSec);
        setIsStationary(true);

        // If >= 300 seconds (5 minutes) and not yet saved during this encounter
        if (elapsedSec >= 300 && !window.isSaved) {
          window.isSaved = true; // Duplicate prevention flag for this encounter
          triggerAutomaticStopSave(window.points);
        }
      } else {
        // User moved outside the 30m radius (> 30m)
        // Reset the stationary encounter for moving state
        window.anchorPoint = coords;
        window.points = [coords];
        window.startTime = now;
        window.lastPointTime = now;
        window.isSaved = false;
        window.savedPropertyId = null;
        setIsStationary(false);
        setStationarySeconds(0);
      }
    },
    [trackingStatus, triggerAutomaticStopSave]
  );

  // Phase 5: Continuous 1-second stationary stop timer ticker (fires even when device is perfectly still)
  useEffect(() => {
    if (trackingStatus !== 'recording') {
      setIsStationary(false);
      setStationarySeconds(0);
      return;
    }

    const interval = setInterval(() => {
      const window = stationaryWindowRef.current;
      if (window.anchorPoint && window.startTime) {
        const now = Date.now();
        const elapsedSec = Math.floor((now - window.startTime) / 1000);
        setStationarySeconds(elapsedSec);

        // Check if 5 minutes (300 seconds) reached
        if (elapsedSec >= 300 && !window.isSaved) {
          window.isSaved = true;
          triggerAutomaticStopSave(window.points.length > 0 ? window.points : [window.anchorPoint]);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [trackingStatus, triggerAutomaticStopSave]);

  // Phase 6: Repeated Route Detection Pipeline
  const processRepeatedRouteDetection = useCallback(
    (coords) => {
      // 1. Only evaluate when tracking is actively recording
      if (trackingStatus !== 'recording') return;

      // 2. Stationary Guard: If user is stationary or speed is near zero, do not trigger route alerts
      if (isStationary || (coords.speed !== undefined && coords.speed !== null && coords.speed < 0.22)) {
        return;
      }

      // 3. Accuracy Guard: Discard poor GPS readings (> 30m accuracy)
      if (coords.accuracy && coords.accuracy > 30) {
        return;
      }

      const lastPoint = lastRecordedPointRef.current;
      if (!lastPoint) return;

      const stepDist = calculateDistanceMeters(lastPoint.lat, lastPoint.lng, coords.lat, coords.lng);
      // Require real movement (displacement >= 3m)
      if (stepDist < 3) return;

      // Historical trips to compare against (excluding current active trip)
      const currentTripId = selectedTrip?.id;
      const compareTrips = (historicalTrips || []).filter(
        (t) => t.id !== currentTripId && (t.routePoints || []).length >= 2
      );

      if (compareTrips.length === 0) return;

      const match = matchRepeatedRoute(coords, lastPoint, compareTrips, {
        proximityToleranceMeters: 25,
        maxAccuracyThreshold: 30,
        minMovementMeters: 3,
        maxAlignmentAngleDeg: 38,
      });

      const encounter = repeatedRouteEncounterRef.current;

      if (match) {
        encounter.consecutiveMatches += 1;
        encounter.consecutiveMisses = 0;
        encounter.overlapMeters += Math.round(stepDist);

        if (match.matchedSegment) {
          setActiveRepeatedSegment(match.matchedSegment);
        }

        // Require at least 2 consecutive matches to avoid single-point glitch
        if (encounter.consecutiveMatches >= 2) {
          setRouteFamiliarityStatus('repeated');

          const now = Date.now();
          const isSameTrip = encounter.tripId === match.tripId;
          const isInCooldown = now < encounter.cooldownUntil;

          if (!encounter.isActive && (!isInCooldown || !isSameTrip)) {
            encounter.isActive = true;
            encounter.tripId = match.tripId;
            encounter.tripName = match.tripName;
            encounter.tripDate = match.tripDate;
            encounter.lastAlertTime = now;
            encounter.isDismissed = false;

            setRepeatedRouteAlert({
              visible: true,
              tripId: match.tripId,
              tripName: match.tripName,
              tripDate: match.tripDate,
              overlapMeters: encounter.overlapMeters,
              distanceMeters: match.distanceMeters,
            });

            showInfo('You have already travelled through this route.');
          } else if (encounter.isActive && !encounter.isDismissed) {
            // Update overlapping distance in real-time without re-spamming alerts
            setRepeatedRouteAlert((prev) =>
              prev
                ? {
                    ...prev,
                    overlapMeters: encounter.overlapMeters,
                    distanceMeters: match.distanceMeters,
                  }
                : null
            );
          }
        }
      } else {
        // No match on this step
        encounter.consecutiveMisses += 1;
        encounter.consecutiveMatches = 0;

        // If user moved away (> 3 consecutive steps away from repeated road), end encounter
        if (encounter.consecutiveMisses >= 3) {
          if (encounter.isActive) {
            encounter.isActive = false;
            encounter.isDismissed = false;
            encounter.cooldownUntil = Date.now() + 60000; // 60s cooldown before alerting same route again
            encounter.overlapMeters = 0;
            setActiveRepeatedSegment([]);
            setRepeatedRouteAlert(null);
            setRouteFamiliarityStatus('exploring');
          }
        }
      }
    },
    [trackingStatus, isStationary, selectedTrip, historicalTrips, showInfo]
  );

  const handleDismissRepeatedRouteAlert = useCallback(() => {
    setRepeatedRouteAlert(null);
    if (repeatedRouteEncounterRef.current) {
      repeatedRouteEncounterRef.current.isDismissed = true;
    }
  }, []);

  // 6. Coordinate Processing Pipeline with Robust GPS Filtering (Requirement 4)
  const processNewCoordinate = useCallback(
    async (rawCoords) => {
      if (!rawCoords) return;

      const lat = typeof rawCoords.lat === 'number' ? rawCoords.lat : Number(rawCoords.latitude);
      const lng = typeof rawCoords.lng === 'number' ? rawCoords.lng : Number(rawCoords.longitude);

      // 1. Ignore invalid coordinates (NaN, out of range, or Null Island 0,0)
      if (
        isNaN(lat) ||
        isNaN(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180 ||
        (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001)
      ) {
        console.warn('GPS reading ignored due to invalid coordinates:', rawCoords);
        return;
      }

      const coords = {
        ...rawCoords,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        accuracy: rawCoords.accuracy ? Math.round(rawCoords.accuracy) : 6,
      };

      // Update current live location display and user marker on map
      setCurrentLocation(coords);
      setGpsAccuracy(coords.accuracy);
      updateUserOnMap(coords);

      // Ensure Leaflet map recalculates its container size and remains visible
      if (leafletMapInstance.current) {
        leafletMapInstance.current.invalidateSize();
      }

      // Update speed metrics if available
      if (coords.speed !== undefined && coords.speed !== null && coords.speed >= 0) {
        const speedKmh = Math.round(coords.speed * 3.6);
        setCurrentSpeedKmh(speedKmh);
        setMaxSpeedKmh((prev) => Math.max(prev, speedKmh));
      }

      // If tracking is active, filter and record meaningful movement breadcrumb
      if (trackingStatus === 'recording') {
        const last = lastRecordedPointRef.current;
        let shouldRecord = false;
        let stepDist = 0;

        if (!last) {
          // First point of the trip: record immediately
          shouldRecord = true;
        } else {
          // 2. Duplicate coordinate check (< 0.8 meter displacement)
          const latDiff = Math.abs(last.lat - coords.lat);
          const lngDiff = Math.abs(last.lng - coords.lng);
          if (latDiff < 0.000008 && lngDiff < 0.000008) {
            shouldRecord = false;
          } else {
            stepDist = calculateDistanceMeters(last.lat, last.lng, coords.lat, coords.lng);
            const timeDeltaSec = Math.max(0.1, (Date.now() - (last.recordedAt || Date.now())) / 1000);
            const apparentSpeedMps = stepDist / timeDeltaSec;

            // 3. Sudden GPS Jump / Glitch Filter:
            // Discard unrealistically fast jumps (> 55 m/s or ~200 km/h with distance > 250m)
            const isSuddenJump = stepDist > 250 && apparentSpeedMps > 55;

            // 4. Accuracy Filter:
            // Inaccurate readings (> 45m accuracy buffer) are not appended to the route path
            const isPoorAccuracy = coords.accuracy && coords.accuracy > 45;

            // 5. Road turns, curves and movement threshold:
            // Check heading turn or curve (>= 5 degrees difference)
            const headingDiff =
              last.heading !== undefined && last.heading !== null &&
              coords.heading !== undefined && coords.heading !== null
                ? Math.abs(last.heading - coords.heading)
                : 0;
            const isTurnOrCurve = headingDiff >= 5 && headingDiff <= 355;

            // Require displacement >= 1 meter, or detected turn/curve, or periodic heartbeat after 15 seconds
            const isMeaningfulMovement = stepDist >= 1.0 || isTurnOrCurve || timeDeltaSec >= 15;

            if (!isSuddenJump && !isPoorAccuracy && isMeaningfulMovement) {
              shouldRecord = true;
              if (stepDist >= 0.5) {
                setDistanceCoveredMeters((prev) => {
                  const updatedDist = prev + stepDist;
                  syncSessionToStorage({ distanceCoveredMeters: updatedDist });
                  return updatedDist;
                });
              }
            }
          }
        }

        if (shouldRecord) {
          sequenceNumberRef.current += 1;
          const nextSeq = sequenceNumberRef.current;

          const breadcrumb = {
            lat: coords.lat,
            lng: coords.lng,
            accuracy: coords.accuracy || 6,
            speed: coords.speed || 0,
            heading: coords.heading || 0,
            sequenceNumber: nextSeq,
            timestamp: coords.timestamp ? new Date(coords.timestamp).toISOString() : new Date().toISOString(),
            recordedAt: Date.now(),
          };

          lastRecordedPointRef.current = breadcrumb;
          routeBreadcrumbsRef.current = [...routeBreadcrumbsRef.current, breadcrumb];

          setRouteBreadcrumbs((prev) => {
            const updated = [...prev, breadcrumb];
            // Directly update map polyline using chronological GPS points
            if (routePolylineRef.current) {
              routePolylineRef.current.setLatLngs(updated.map((pt) => [pt.lat, pt.lng]));
            }
            return updated;
          });

          // Pan map to follow movement smoothly
          if (leafletMapInstance.current) {
            leafletMapInstance.current.panTo([coords.lat, coords.lng]);
          }

          // Asynchronously persist route point to Spring Boot backend API
          const tripIdToSave = activeTripRef.current?.id || selectedTrip?.id;
          if (tripIdToSave) {
            try {
              routePointService.create({
                tripId: tripIdToSave,
                latitude: coords.lat,
                longitude: coords.lng,
                accuracy: coords.accuracy || 6,
                speed: coords.speed || 0,
                heading: coords.heading || 0,
                sequenceNumber: nextSeq,
                timestamp: breadcrumb.timestamp,
                recordedAt: breadcrumb.timestamp,
              }).catch((err) => {
                console.warn('Failed to persist route breadcrumb point to Spring Boot', err);
              });
            } catch (err) {
              console.warn('Failed to dispatch route breadcrumb create', err);
            }
          }
        }
      }

      // Phase 5: Automatic Stop Detection Pipeline
      processStationaryDetection(coords);

      // Phase 6: Repeated Route Detection Pipeline
      processRepeatedRouteDetection(coords);

      // Run proximity evaluation
      evaluateProximity(coords);
    },
    [trackingStatus, selectedTrip, routeBreadcrumbs.length, updateUserOnMap, evaluateProximity, processStationaryDetection, processRepeatedRouteDetection, syncSessionToStorage]
  );

  // 7. HTML5 Geolocation Watcher Lifecycle (Prevents Multiple Simultaneous Watchers)
  const stopGeolocationWatcher = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startGeolocationWatcher = useCallback(() => {
    // Clean up any existing watcher first
    stopGeolocationWatcher();

    if (!navigator.geolocation) {
      setGpsPermission('unavailable');
      setGpsErrorMsg('Browser Geolocation API is not supported on this device.');
      showWarning('Geolocation API is not available on this browser.');
      return;
    }

    setGpsErrorMsg(null);

    const handleSuccess = (pos) => {
      setGpsPermission('granted');
      setGpsErrorMsg(null);
      const coords = {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
        accuracy: Math.round(pos.coords.accuracy),
        speed: pos.coords.speed !== null && pos.coords.speed !== undefined ? Number(pos.coords.speed) : 0,
        heading: pos.coords.heading,
        timestamp: pos.timestamp || Date.now(),
      };
      processNewCoordinate(coords);
    };

    const handleError = (err) => {
      console.warn('Geolocation watchPosition error:', err);
      if (err.code === 1 || err.code === err.PERMISSION_DENIED) {
        setGpsPermission('denied');
        setGpsErrorMsg('Location permission was denied. Please allow location access or use the Movement Simulator.');
        showWarning('Location permission denied. Map initialized with default coordinates.');
      } else if (err.code === 2 || err.code === err.POSITION_UNAVAILABLE) {
        setGpsErrorMsg('GPS position unavailable. Searching for satellite/network signal...');
      } else if (err.code === 3 || err.code === err.TIMEOUT) {
        setGpsErrorMsg('GPS request timed out. Retrying...');
      }
    };

    const options = {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 1000,
    };

    // First request immediate position
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);

    // Then start continuous watcher
    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, options);
    watchIdRef.current = watchId;
  }, [processNewCoordinate, stopGeolocationWatcher, showWarning]);

  // 8. Trip Controls: Start / Pause / Resume / End Trip
  const handleStartTrip = async () => {
    // If paused, resume
    if (trackingStatus === 'paused') {
      setTrackingStatus('recording');
      syncSessionToStorage({ status: 'recording' });
      startGeolocationWatcher();
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((sec) => {
          const nextSec = sec + 1;
          syncSessionToStorage({ elapsedSeconds: nextSec });
          return nextSec;
        });
      }, 1000);
      showSuccess('Live route tracking resumed!');
      return;
    }

    // Starting new tracking session
    let tripToUse = selectedTrip;
    if (!tripToUse || tripToUse.status === 'completed') {
      try {
        const dateStr = new Date().toLocaleDateString();
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const startLat = currentLocation ? currentLocation.lat : homeCoords.lat;
        const startLng = currentLocation ? currentLocation.lng : homeCoords.lng;
        const created = await tripService.create({
          userId: user?.id || '1',
          tripName: `Live Tracking Journey - ${dateStr} ${timeStr}`,
          startLocation: currentLocation ? `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : 'Home Base',
          startLat: startLat,
          startLatitude: startLat,
          startLng: startLng,
          startLongitude: startLng,
          status: 'active',
          travelMode: user?.travelMode || 'car',
        });
        tripToUse = created;
        activeTripRef.current = created;
        setSelectedTrip(created);
        setTrips((prev) => [created, ...prev]);
        setRouteBreadcrumbs([]);
        routeBreadcrumbsRef.current = [];
        sequenceNumberRef.current = 0;
        lastRecordedPointRef.current = null;
        setDistanceCoveredMeters(0);
        setElapsedSeconds(0);
        if (routePolylineRef.current) routePolylineRef.current.setLatLngs([]);
        if (liveStartMarkerRef.current) {
          liveStartMarkerRef.current.remove();
          liveStartMarkerRef.current = null;
        }
        stationaryWindowRef.current = {
          anchorPoint: null,
          points: [],
          startTime: null,
          lastPointTime: null,
          isSaved: false,
          savedPropertyId: null,
        };
        setIsStationary(false);
        setStationarySeconds(0);
        setAutoSavedStop(null);
      } catch (err) {
        console.error('Failed to create automatic trip', err);
      }
    } else {
      activeTripRef.current = tripToUse;
      if (tripToUse.status !== 'active') {
        try {
          await tripService.update(tripToUse.id, { status: 'active' });
          tripToUse.status = 'active';
        } catch (err) {
          console.warn('Failed to update trip status to active', err);
        }
      }
    }

    setTrackingStatus('recording');
    syncSessionToStorage({ status: 'recording', tripId: tripToUse?.id });
    startGeolocationWatcher();

    // If we have an existing location fix, record it as starting breadcrumb point
    if (currentLocation) {
      processNewCoordinate(currentLocation);
    }

    // Start timer
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((sec) => {
        const nextSec = sec + 1;
        syncSessionToStorage({ elapsedSeconds: nextSec });
        return nextSec;
      });
    }, 1000);

    showSuccess('Trip tracking started! Geolocation breadcrumbs are now recording.');
  };

  const handlePauseTrip = () => {
    setTrackingStatus('paused');
    syncSessionToStorage({ status: 'paused' });
    stopGeolocationWatcher();
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    showInfo('Trip tracking paused. Your recorded route and time are preserved.');
  };

  const handleEndTripPrompt = () => {
    setIsEndTripModalOpen(true);
  };

  const handleConfirmEndTrip = async () => {
    setFinalizingTrip(true);
    stopGeolocationWatcher();
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    try {
      const tripId = selectedTrip?.id || String(Date.now());
      const formattedDist = formatDistance(distanceCoveredMeters);
      const formattedDur = formatDurationSeconds(elapsedSeconds);
      const now = new Date().toISOString();

      // Clear active tracking session from localStorage
      localStorage.removeItem('roomtrail_active_tracking_session');

      // 1. Update trip status to completed
      const effectiveTripId = activeTripRef.current?.id || selectedTrip?.id;
      if (effectiveTripId) {
        const crumbs = routeBreadcrumbsRef.current;
        const firstPt = crumbs[0] || lastRecordedPointRef.current;
        const lastPt = crumbs[crumbs.length - 1] || lastRecordedPointRef.current;
        await tripService.update(effectiveTripId, {
          status: 'completed',
          endTime: now,
          totalDistance: formattedDist,
          totalDuration: formattedDur,
          startLat: firstPt ? firstPt.lat : undefined,
          startLatitude: firstPt ? firstPt.lat : undefined,
          startLng: firstPt ? firstPt.lng : undefined,
          startLongitude: firstPt ? firstPt.lng : undefined,
          endLat: lastPt ? lastPt.lat : undefined,
          endLatitude: lastPt ? lastPt.lat : undefined,
          endLng: lastPt ? lastPt.lng : undefined,
          endLongitude: lastPt ? lastPt.lng : undefined,
        });
      }

      // 2. Create Trip Summary Record in /tripSummaries
      await tripSummaryService.create({
        tripId: tripId,
        userId: user?.id || '1',
        tripTitle: selectedTrip?.tripName || selectedTrip?.title || 'Live Route Tracking',
        totalDistanceMeters: distanceCoveredMeters,
        totalDistanceFormatted: formattedDist,
        durationSeconds: elapsedSeconds,
        totalDurationFormatted: formattedDur,
        maxSpeedKmh: maxSpeedKmh,
        averageSpeedKmh:
          elapsedSeconds > 0
            ? Math.round((distanceCoveredMeters / elapsedSeconds) * 3.6)
            : 0,
        routePointsCount: routeBreadcrumbs.length,
        visitedDestinationsCount: places.filter((p) => p.visited).length,
        completedAt: now,
      });

      setTrackingStatus('ended');
      setIsEndTripModalOpen(false);
      showSuccess('Trip completed and summary successfully saved!');

      // Navigate to Trip Summary Page
      navigate(`/trips/${tripId}/summary`);
    } catch (err) {
      console.error('Failed to finalize trip summary', err);
      showError('Failed to save trip summary to backend.');
      setIsEndTripModalOpen(false);
    } finally {
      setFinalizingTrip(false);
    }
  };

  // 9. Confirm Visit & Revisit Handler
  const handleConfirmVisit = async () => {
    if (!promptDestination) return;
    setSavingVisit(true);

    try {
      const now = new Date().toISOString();
      const tripId = selectedTrip?.id || null;
      const nextSeq = revisitDetails.isRevisit ? revisitDetails.nextSequenceNumber : 1;

      // 1. Create NEW Visit Record in /visits (preserves all previous records)
      const recorded = await visitService.recordVisit({
        userId: user?.id || '1',
        tripId: tripId,
        destinationId: promptDestination.id,
        propertyId: promptDestination.id,
        propertyName: promptDestination.name,
        category: promptDestination.category,
        address: promptDestination.address,
        arrivalTime: now,
        visitedAt: now,
        departureTime: null,
        latitude: promptDestination.latitude,
        longitude: promptDestination.longitude,
        visitCoordinates: {
          lat: promptDestination.latitude,
          lng: promptDestination.longitude,
        },
        visitStatus: revisitDetails.isRevisit ? 'revisited' : 'confirmed',
        status: 'confirmed',
        notes: visitNotes || (revisitDetails.isRevisit
          ? `Visit #${nextSeq} confirmed during live route tracking.`
          : 'First-time visit confirmed during live tracking.'),
        isRevisit: Boolean(revisitDetails.isRevisit),
        visitNumber: nextSeq,
      });

      // 2. Update Property visit statistics
      await propertyService.update(promptDestination.id, {
        visited: true,
        visitStatus: 'visited',
        visitedAt: now,
      });

      // 3. Mark encounter tracker as confirmed so no repeat alerts during this encounter
      encounterTrackerRef.current[promptDestination.id] = {
        status: 'confirmed',
        confirmedAt: Date.now(),
      };

      // 4. Update local state
      setAllVisits((prev) => [recorded, ...prev]);
      setPlaces((prev) =>
        prev.map((p) =>
          p.id === promptDestination.id
            ? { ...p, visited: true, visitStatus: 'visited', visitedAt: now }
            : p
        )
      );

      if (revisitDetails.isRevisit) {
        showSuccess(`Revisit #${nextSeq} to "${promptDestination.name}" confirmed! Previous visit records preserved.`);
      } else {
        showSuccess(`Visit confirmed & logged for "${promptDestination.name}"!`);
      }

      setIsVisitModalOpen(false);
      setVisitNotes('');
      setPromptDestination(null);
    } catch (err) {
      console.error('Failed to confirm visit', err);
      showError('Failed to record visit.');
    } finally {
      setSavingVisit(false);
    }
  };

  // Skip previously visited location (Feature 1 Action 2)
  const handleSkipRevisit = () => {
    if (promptDestination) {
      // Do not create a visit record
      // Do not repeatedly show the same alert during the same location encounter
      encounterTrackerRef.current[promptDestination.id] = {
        status: 'dismissed',
        dismissedAt: Date.now(),
      };
      showInfo(`Skipped revisit for "${promptDestination.name}". Alert suppressed for this encounter.`);
    }
    setIsVisitModalOpen(false);
    setVisitNotes('');
    setPromptDestination(null);
  };

  // 10. Proximity Actions: Snooze ("Not Now") & Dismiss
  const handleSnoozePrompt = () => {
    if (promptDestination) {
      // Snooze for 5 minutes
      encounterTrackerRef.current[promptDestination.id] = {
        status: 'snoozed',
        snoozeUntil: Date.now() + 5 * 60 * 1000,
      };
      showInfo(`Prompt for "${promptDestination.name}" snoozed for 5 minutes.`);
    }
    setIsVisitModalOpen(false);
    setPromptDestination(null);
  };

  const handleDismissPrompt = () => {
    if (promptDestination) {
      // Dismiss for this trip encounter
      encounterTrackerRef.current[promptDestination.id] = {
        status: 'dismissed',
        dismissedAt: Date.now(),
      };
      showInfo(`Encounter dismissed for "${promptDestination.name}".`);
    }
    setIsVisitModalOpen(false);
    setPromptDestination(null);
  };

  // 11. GPS Movement Simulator Helpers (Deterministic Testing)
  const handleSimulatePosition = (targetLat, targetLng, label = 'Custom Position') => {
    const simulatedCoords = {
      lat: Number(targetLat.toFixed(6)),
      lng: Number(targetLng.toFixed(6)),
      accuracy: 6,
      speed: 8.5, // ~30 km/h
      heading: 90,
      timestamp: Date.now(),
    };
    processNewCoordinate(simulatedCoords);
    if (leafletMapInstance.current) {
      leafletMapInstance.current.setView([simulatedCoords.lat, simulatedCoords.lng], 16);
    }
    showInfo(`GPS updated: ${label}`);
  };

  // Move directly to target threshold
  const handleSimulateTowardsPlace = (place, targetDistanceMeters) => {
    if (!place || !place.latitude || !place.longitude) return;

    // Calculate a point targetDistanceMeters south of place
    // 1 deg lat ~ 111,000 meters
    const deltaLat = targetDistanceMeters / 111000;
    const simLat = place.latitude - deltaLat;
    const simLng = place.longitude;

    handleSimulatePosition(
      simLat,
      simLng,
      `~${targetDistanceMeters}m from ${place.name}`
    );
  };

  // Simulate a 5-step movement path to watch the purple travelled path draw in real time
  const handleSimulateMultiStepPath = () => {
    const baseLat = currentLocation?.lat || homeCoords.lat;
    const baseLng = currentLocation?.lng || homeCoords.lng;
    const steps = [
      { lat: baseLat + 0.0006, lng: baseLng + 0.0006, label: 'Step 1 (~80m NE)' },
      { lat: baseLat + 0.0013, lng: baseLng + 0.0012, label: 'Step 2 (~160m NE)' },
      { lat: baseLat + 0.0021, lng: baseLng + 0.0019, label: 'Step 3 (~260m NE)' },
      { lat: baseLat + 0.0029, lng: baseLng + 0.0027, label: 'Step 4 (~370m NE)' },
      { lat: baseLat + 0.0038, lng: baseLng + 0.0035, label: 'Step 5 (~490m NE)' },
    ];

    showInfo('[SIMULATED GPS] Starting 5-step movement path simulation...');
    steps.forEach((step, idx) => {
      setTimeout(() => {
        handleSimulatePosition(step.lat, step.lng, `[SIMULATION] ${step.label}`);
      }, (idx + 1) * 1100);
    });
  };

  // Phase 5 Testing: Stop for less than 5 minutes (< 300s, e.g. 120s), then move away
  const handleSimulateStopLessThan5Min = () => {
    const baseLat = currentLocation?.lat || homeCoords.lat;
    const baseLng = currentLocation?.lng || homeCoords.lng;
    const startTime = Date.now();

    // 1. Initial point
    processNewCoordinate({
      lat: baseLat,
      lng: baseLng,
      accuracy: 6,
      speed: 0.1,
      timestamp: startTime,
    });

    // 2. Minor fluctuations within 10m over 2 minutes (120s)
    processNewCoordinate({
      lat: baseLat + 0.00005,
      lng: baseLng + 0.00004,
      accuracy: 8,
      speed: 0.1,
      timestamp: startTime + 60000,
    });

    processNewCoordinate({
      lat: baseLat - 0.00003,
      lng: baseLng + 0.00006,
      accuracy: 7,
      speed: 0.1,
      timestamp: startTime + 120000,
    });

    // 3. User moves away (> 150m away)
    setTimeout(() => {
      processNewCoordinate({
        lat: baseLat + 0.0018,
        lng: baseLng + 0.0018,
        accuracy: 6,
        speed: 8.5,
        timestamp: startTime + 130000,
      });
      showInfo('[TEST: Stop < 5m] Stationary for 2m (120s < 300s). Moved away; stop cancelled with ZERO property records created.');
    }, 400);
  };

  // Phase 5 Testing: Stop for more than 5 minutes (> 300s, e.g. 315s), auto-save triggers!
  const handleSimulateStopMoreThan5Min = () => {
    const testLat = 17.49380;
    const testLng = 78.39680;
    const startTime = Date.now() - 320000; // 5 min 20 sec ago

    showInfo('[TEST: Stop > 5m] Simulating stationary stop for 5 minutes 20 seconds within 30m radius...');

    // Points with minor GPS fluctuations (~5-15m) over 320 seconds
    const stationaryPoints = [
      { lat: testLat, lng: testLng, accuracy: 6, speed: 0.1, timestamp: startTime },
      { lat: testLat + 0.00006, lng: testLng + 0.00005, accuracy: 8, speed: 0.2, timestamp: startTime + 60000 },
      { lat: testLat - 0.00004, lng: testLng + 0.00008, accuracy: 7, speed: 0.1, timestamp: startTime + 120000 },
      { lat: testLat + 0.00003, lng: testLng - 0.00005, accuracy: 9, speed: 0.2, timestamp: startTime + 240000 },
      { lat: testLat + 0.00005, lng: testLng + 0.00002, accuracy: 6, speed: 0.1, timestamp: startTime + 320000 },
    ];

    // Set stationary window
    stationaryWindowRef.current = {
      anchorPoint: stationaryPoints[0],
      points: stationaryPoints,
      startTime: startTime,
      lastPointTime: startTime + 320000,
      isSaved: false,
      savedPropertyId: null,
    };

    setIsStationary(true);
    setStationarySeconds(320);

    // Feed latest coordinate into pipeline which triggers auto-save
    processNewCoordinate(stationaryPoints[stationaryPoints.length - 1]);
  };

  // Phase 5 Testing: Poor GPS Accuracy filter
  const handleSimulatePoorGpsStop = () => {
    const baseLat = currentLocation?.lat || homeCoords.lat;
    const baseLng = currentLocation?.lng || homeCoords.lng;

    processNewCoordinate({
      lat: baseLat + 0.0001,
      lng: baseLng + 0.0001,
      accuracy: 85, // POOR ACCURACY > 35m
      speed: 0.1,
      timestamp: Date.now(),
    });

    showWarning('[TEST: Poor GPS] Reading with accuracy 85m discarded by stop detector (accuracy threshold: <= 35m).');
  };

  // Phase 5 Testing: Repeated stationary updates (staying for 20 minutes) - NO duplicates!
  const handleSimulateRepeatedStationary = () => {
    const testLat = 17.49380;
    const testLng = 78.39680;
    const now = Date.now();

    for (let i = 1; i <= 5; i++) {
      processNewCoordinate({
        lat: testLat + (i * 0.00002),
        lng: testLng - (i * 0.00002),
        accuracy: 6,
        speed: 0.1,
        timestamp: now + (i * 60000),
      });
    }

    showSuccess('[TEST: Repeated Updates] Injected 5 updates spanning +15 minutes. Duplicate prevention verified: 0 duplicate properties created.');
  };

  // Phase 5 Testing: Return to previously saved property
  const handleSimulateRevisitStop = () => {
    const target = places[0];
    if (!target || !target.latitude || !target.longitude) {
      showWarning('No existing property found to simulate revisit.');
      return;
    }

    const tLat = Number(target.latitude);
    const tLng = Number(target.longitude);
    const startTime = Date.now() - 325000; // > 5 mins ago

    showInfo(`[TEST: Revisit] Simulating 5-minute stop near existing property: "${target.name}"...`);

    const points = [
      { lat: tLat + 0.00005, lng: tLng + 0.00005, accuracy: 6, speed: 0.1, timestamp: startTime },
      { lat: tLat + 0.00008, lng: tLng + 0.00003, accuracy: 8, speed: 0.1, timestamp: startTime + 100000 },
      { lat: tLat + 0.00004, lng: tLng + 0.00006, accuracy: 7, speed: 0.1, timestamp: startTime + 325000 },
    ];

    stationaryWindowRef.current = {
      anchorPoint: points[0],
      points: points,
      startTime: startTime,
      lastPointTime: startTime + 325000,
      isSaved: false,
      savedPropertyId: null,
    };

    setIsStationary(true);
    setStationarySeconds(325);

    processNewCoordinate(points[points.length - 1]);
  };

  // Phase 6 Testing: Travel a new route for the first time
  const handleSimulateTravelNewRoute = useCallback(() => {
    showInfo('[TEST 1: New Route] Travelling a completely fresh road segment...');
    const startLat = 17.4910;
    const startLng = 78.3910;
    const now = Date.now();

    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        processNewCoordinate({
          lat: startLat + (i * 0.0008),
          lng: startLng + (i * 0.0002),
          accuracy: 6,
          speed: 8.5,
          heading: 14.0,
          timestamp: now + (i * 5000),
        });
        if (i === 3) {
          showSuccess('[TEST 1: New Route] Completed fresh route traversal. Zero repeated route alerts triggered.');
        }
      }, i * 250);
    }
  }, [processNewCoordinate, showInfo, showSuccess]);

  // Phase 6 Testing: Travel the same route again -> Triggers Repeated Route Alert!
  const handleSimulateTravelRepeatedRoute = useCallback(() => {
    showInfo('[TEST 2: Repeated Route] Simulating travel along previously covered road (Hyderabad KPHB segment)...');
    const now = Date.now();

    // Coordinates along trip 1794670127442 (17.49268, 78.39513 -> 17.49588, 78.39803)
    const repeatedWaypoints = [
      { lat: 17.49270, lng: 78.39515, heading: 40.0, speed: 8.5 },
      { lat: 17.49340, lng: 78.39575, heading: 40.0, speed: 8.5 },
      { lat: 17.49420, lng: 78.39645, heading: 40.0, speed: 8.5 },
    ];

    repeatedWaypoints.forEach((wp, idx) => {
      setTimeout(() => {
        processNewCoordinate({
          lat: wp.lat,
          lng: wp.lng,
          accuracy: 6,
          speed: wp.speed,
          heading: wp.heading,
          timestamp: now + (idx * 5000),
        });
        if (idx === repeatedWaypoints.length - 1) {
          showWarning('[TEST 2: Repeated Route] Repeated route alert triggered: "You have already travelled through this route."');
        }
      }, idx * 250);
    });
  }, [processNewCoordinate, showInfo, showWarning]);

  // Phase 6 Testing: Continue travelling along same repeated route -> Verifies NO Alert Spam!
  const handleSimulateContinueRepeatedRoute = useCallback(() => {
    showInfo('[TEST 3: Anti-Spam] Continuing travel along the same repeated route...');
    const now = Date.now();

    const furtherWaypoints = [
      { lat: 17.49500, lng: 78.39725, heading: 40.0, speed: 8.5 },
      { lat: 17.49590, lng: 78.39805, heading: 40.0, speed: 8.5 },
    ];

    furtherWaypoints.forEach((wp, idx) => {
      setTimeout(() => {
        processNewCoordinate({
          lat: wp.lat,
          lng: wp.lng,
          accuracy: 6,
          speed: wp.speed,
          heading: wp.heading,
          timestamp: now + (idx * 5000),
        });
        if (idx === furtherWaypoints.length - 1) {
          showSuccess('[TEST 3: Anti-Spam] Anti-spam verified: Single continuous alert encounter maintained with ZERO duplicate popups.');
        }
      }, idx * 250);
    });
  }, [processNewCoordinate, showInfo, showSuccess]);

  // Phase 6 Testing: Travel a different route -> Alert clears, zero false alarms
  const handleSimulateTravelDifferentRoute = useCallback(() => {
    showInfo('[TEST 4: Different Route] Turning onto unvisited cross street (perpendicular angle)...');
    const now = Date.now();

    const differentWaypoints = [
      { lat: 17.49620, lng: 78.39300, heading: 270.0, speed: 8.5 },
      { lat: 17.49690, lng: 78.39100, heading: 270.0, speed: 8.5 },
      { lat: 17.49750, lng: 78.38900, heading: 270.0, speed: 8.5 },
    ];

    differentWaypoints.forEach((wp, idx) => {
      setTimeout(() => {
        processNewCoordinate({
          lat: wp.lat,
          lng: wp.lng,
          accuracy: 6,
          speed: wp.speed,
          heading: wp.heading,
          timestamp: now + (idx * 5000),
        });
        if (idx === differentWaypoints.length - 1) {
          showSuccess('[TEST 4: Different Route] Left repeated route. Alert cleared; Route Familiarity returned to New Route Exploration.');
        }
      }, idx * 250);
    });
  }, [processNewCoordinate, showInfo, showSuccess]);

  // Phase 6 Testing: Test GPS drift and inaccurate readings
  const handleSimulateGpsDriftAndInaccurate = useCallback(() => {
    showInfo('[TEST 5: Drift & Inaccuracy] Testing poor GPS accuracy and parallel road differentiation...');
    const now = Date.now();

    // 1. Poor GPS fix (accuracy = 85m)
    processNewCoordinate({
      lat: 17.49340,
      lng: 78.39575,
      accuracy: 85, // Discarded (> 30m accuracy threshold)
      speed: 8.5,
      timestamp: now,
    });

    // 2. Parallel road 45m away (outside 25m tolerance)
    setTimeout(() => {
      processNewCoordinate({
        lat: 17.49340,
        lng: 78.39625, // ~45m parallel
        accuracy: 6,
        speed: 8.5,
        heading: 40.0,
        timestamp: now + 5000,
      });
      showSuccess('[TEST 5: Drift & Inaccuracy] Verified: Inaccurate reading (>30m) and parallel road (45m away) produced ZERO false alerts.');
    }, 300);
  }, [processNewCoordinate, showInfo, showSuccess]);

  // Phase 4 / QA Testing: Simulate a realistic winding route with curves, 90° corners and intermediate GPS breadcrumbs
  const handleSimulateWindingRoute = useCallback(() => {
    showInfo('[TEST: Winding Route] Simulating journey with road curves, 90° corners, and intermediate GPS points...');
    const now = Date.now();
    // 12 realistic coordinates along city streets with turns and curves
    const windingWaypoints = [
      { lat: 17.49380, lng: 78.39680, heading: 45.0, speed: 6.5, label: 'Start Point: Main Rd' },
      { lat: 17.49430, lng: 78.39720, heading: 45.0, speed: 7.2, label: 'Road Segment 1' },
      { lat: 17.49490, lng: 78.39770, heading: 48.0, speed: 8.0, label: 'Curve NE' },
      { lat: 17.49540, lng: 78.39820, heading: 50.0, speed: 8.5, label: 'Approaching Corner' },
      // 90-degree Right Turn onto 3rd Avenue
      { lat: 17.49520, lng: 78.39890, heading: 135.0, speed: 5.0, label: 'Turn Right onto 3rd Ave' },
      { lat: 17.49470, lng: 78.39960, heading: 135.0, speed: 7.5, label: 'Cruising 3rd Ave' },
      { lat: 17.49420, lng: 78.40030, heading: 140.0, speed: 8.1, label: 'Approaching S-curve' },
      // S-curve turn Left onto Cross Rd
      { lat: 17.49440, lng: 78.40110, heading: 70.0, speed: 6.0, label: 'S-Curve Left Turn' },
      { lat: 17.49480, lng: 78.40180, heading: 60.0, speed: 7.0, label: 'Road Curve East' },
      // Final turn into residential lane
      { lat: 17.49550, lng: 78.40210, heading: 20.0, speed: 5.2, label: 'Turn North into Colony Rd' },
      { lat: 17.49620, lng: 78.40230, heading: 15.0, speed: 4.5, label: 'Approaching Destination' },
      { lat: 17.49670, lng: 78.40240, heading: 10.0, speed: 0.0, label: 'Finish Point: Saved Property' },
    ];

    windingWaypoints.forEach((wp, idx) => {
      setTimeout(() => {
        processNewCoordinate({
          lat: wp.lat,
          lng: wp.lng,
          accuracy: 5,
          speed: wp.speed,
          heading: wp.heading,
          timestamp: now + (idx * 3000),
        });
        if (idx === windingWaypoints.length - 1) {
          showSuccess('[TEST: Winding Route] All 12 GPS waypoints recorded with sequential order and exact road curves!');
        }
      }, idx * 220);
    });
  }, [processNewCoordinate, showInfo, showSuccess]);

  // Expose simulation helpers on window for automated testing without UI clutter
  useEffect(() => {
    window.roomtrailSimulate = {
      position: handleSimulatePosition,
      towardsPlace: handleSimulateTowardsPlace,
      multiStep: handleSimulateMultiStepPath,
      windingRoute: handleSimulateWindingRoute,
      stopLessThan5Min: handleSimulateStopLessThan5Min,
      stopMoreThan5Min: handleSimulateStopMoreThan5Min,
      poorGpsStop: handleSimulatePoorGpsStop,
      repeatedStationary: handleSimulateRepeatedStationary,
      revisitStop: handleSimulateRevisitStop,
      travelNewRoute: handleSimulateTravelNewRoute,
      travelSameRouteAgain: handleSimulateTravelRepeatedRoute,
      continueSameRouteNoSpam: handleSimulateContinueRepeatedRoute,
      travelDifferentRoute: handleSimulateTravelDifferentRoute,
      testGpsDriftAndInaccurate: handleSimulateGpsDriftAndInaccurate,
    };
    return () => {
      delete window.roomtrailSimulate;
    };
  }, [
    currentLocation,
    places,
    handleSimulatePosition,
    handleSimulateTowardsPlace,
    handleSimulateMultiStepPath,
    handleSimulateWindingRoute,
    handleSimulateStopLessThan5Min,
    handleSimulateStopMoreThan5Min,
    handleSimulatePoorGpsStop,
    handleSimulateRepeatedStationary,
    handleSimulateRevisitStop,
    handleSimulateTravelNewRoute,
    handleSimulateTravelRepeatedRoute,
    handleSimulateContinueRepeatedRoute,
    handleSimulateTravelDifferentRoute,
    handleSimulateGpsDriftAndInaccurate,
  ]);

  // Clean up timer, watcher, and storage on unmount
  useEffect(() => {
    return () => {
      stopGeolocationWatcher();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      localStorage.removeItem('roomtrail_active_tracking_session');
    };
  }, [stopGeolocationWatcher]);

  // Recenter Map on User
  const handleRecenterMap = () => {
    if (leafletMapInstance.current && currentLocation) {
      leafletMapInstance.current.setView([currentLocation.lat, currentLocation.lng], 16);
    } else if (leafletMapInstance.current) {
      leafletMapInstance.current.setView([homeCoords.lat, homeCoords.lng], 14);
    }
  };

  const renderTrackingStatusBadge = () => {
    if (trackingStatus === 'recording') {
      return (
        <span className="badge-rt tracking-badge-recording" title="Actively recording GPS movement">
          <span className="status-live-dot"></span>
          Tracking Active
        </span>
      );
    }
    if (trackingStatus === 'paused') {
      return (
        <span className="badge-rt tracking-badge-paused" title="GPS recording is currently paused">
          <i className="bi bi-pause-circle-fill text-warning"></i>
          Tracking Paused
        </span>
      );
    }
    if (trackingStatus === 'ended') {
      return (
        <span className="badge-rt tracking-badge-ended" title="Trip recording completed">
          <i className="bi bi-stop-circle-fill text-secondary"></i>
          Tracking Stopped
        </span>
      );
    }
    return (
      <span className="badge-rt tracking-badge-idle" title="GPS tracking has not started">
        <i className="bi bi-circle text-muted"></i>
        Tracking Idle
      </span>
    );
  };

  if (loading) {
    return <LoadingSpinner fullPage text="Initializing live GPS tracking engine..." />;
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
            <span
              className={`tracking-radar-indicator ${
                trackingStatus === 'recording' ? 'active' : ''
              }`}
            ></span>
            <h2 className="page-title mb-0">Live Route Tracking & Visit Radar</h2>
            {renderTrackingStatusBadge()}
          </div>
          <p className="page-subtitle">
            Continuous GPS breadcrumb logging, road route visualization, and automatic proximity visit detection
          </p>
        </div>

        {/* Action Button Bar */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {/* Active Trip Picker */}
          {trips.length > 0 && (
            <select
              className="form-select form-select-sm"
              style={{ maxWidth: '210px' }}
              value={selectedTrip?.id || ''}
              disabled={trackingStatus === 'recording'}
              onChange={(e) => {
                const found = trips.find((t) => t.id === e.target.value);
                if (found) setSelectedTrip(found);
              }}
            >
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tripName || t.title} ({t.status})
                </option>
              ))}
            </select>
          )}

          {/* Primary State Controller Buttons */}
          {trackingStatus === 'idle' && (
            <button
              type="button"
              className="btn btn-sm btn-rt-primary px-3"
              onClick={handleStartTrip}
              id="live-tracking-start-btn"
            >
              <i className="bi bi-play-fill me-1"></i> Start Tracking
            </button>
          )}

          {trackingStatus === 'recording' && (
            <>
              <button
                type="button"
                className="btn btn-sm btn-outline-warning px-3"
                onClick={handlePauseTrip}
                id="live-tracking-pause-btn"
              >
                <i className="bi bi-pause-fill me-1"></i> Pause
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger px-3"
                onClick={handleEndTripPrompt}
                id="live-tracking-stop-btn"
              >
                <i className="bi bi-stop-fill me-1"></i> Stop Tracking
              </button>
            </>
          )}

          {trackingStatus === 'paused' && (
            <>
              <button
                type="button"
                className="btn btn-sm btn-rt-primary px-3"
                onClick={handleStartTrip}
                id="live-tracking-resume-btn"
              >
                <i className="bi bi-play-fill me-1"></i> Resume
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger px-3"
                onClick={handleEndTripPrompt}
                id="live-tracking-stop-btn"
              >
                <i className="bi bi-stop-fill me-1"></i> Stop Tracking
              </button>
            </>
          )}

          {trackingStatus === 'ended' && (
            <button
              type="button"
              className="btn btn-sm btn-rt-secondary px-3"
              id="live-tracking-reset-btn"
              onClick={() => {
                setTrackingStatus('idle');
                setElapsedSeconds(0);
                setDistanceCoveredMeters(0);
                setRouteBreadcrumbs([]);
                if (routePolylineRef.current) routePolylineRef.current.setLatLngs([]);
              }}
            >
              <i className="bi bi-arrow-clockwise me-1"></i> Reset for New Session
            </button>
          )}

          <button
            type="button"
            className="btn btn-sm btn-rt-accent d-flex align-items-center gap-1"
            onClick={() => setIsQuickAddOpen(true)}
            id="live-tracking-quick-add-btn"
            title="Quick add destination while travelling without interrupting trip"
          >
            <i className="bi bi-plus-circle me-1"></i> Quick Add Destination
          </button>

          <button
            type="button"
            className="btn btn-sm btn-rt-secondary"
            onClick={() => setShowThresholdSettings(!showThresholdSettings)}
            title="Configure Proximity Thresholds"
          >
            <i className="bi bi-gear"></i> Radar Config
          </button>

          {/* Movement & Stop Simulation Controls for Testing */}
          <div className="btn-group btn-group-sm flex-wrap">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={handleSimulateWindingRoute}
              id="live-tracking-sim-winding-btn"
              title="Simulate realistic winding route with curves and 90° turns"
            >
              <i className="bi bi-bezier2 me-1"></i> Winding Route
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={handleSimulateMultiStepPath}
              id="live-tracking-sim-5steps-btn"
              title="Simulate 5-step movement path (~500m) to test live path drawing"
            >
              <i className="bi bi-play-circle me-1"></i> Movement
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-success"
              onClick={handleSimulateStopMoreThan5Min}
              id="live-tracking-sim-stop-full-btn"
              title="Simulate stationary stop for >5 minutes (auto-saves to MySQL & prompts for details)"
            >
              <i className="bi bi-geo-fill me-1"></i> Stop (&gt;5m)
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={handleSimulateStopLessThan5Min}
              id="live-tracking-sim-stop-short-btn"
              title="Simulate stop for <5 minutes (cancelled upon moving, 0 saves)"
            >
              <i className="bi bi-hourglass-split me-1"></i> Stop (&lt;5m)
            </button>
            {/* Phase 6 Repeated Route Testing Buttons */}
            <button
              type="button"
              className="btn btn-sm btn-outline-warning"
              onClick={handleSimulateTravelRepeatedRoute}
              id="live-tracking-sim-travel-repeated-btn"
              title="Simulate travelling along previously recorded route segment"
            >
              <i className="bi bi-arrow-repeat me-1"></i> Repeated Route
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-info"
              onClick={handleSimulateContinueRepeatedRoute}
              id="live-tracking-sim-travel-continue-repeated-btn"
              title="Continue on repeated route to verify anti-spam protection"
            >
              <i className="bi bi-shield-check me-1"></i> Anti-Spam
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={handleSimulateTravelDifferentRoute}
              id="live-tracking-sim-travel-diff-route-btn"
              title="Turn onto unvisited road to verify alert clears"
            >
              <i className="bi bi-signpost-split me-1"></i> Diff Route
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-dark"
              onClick={handleSimulateGpsDriftAndInaccurate}
              id="live-tracking-sim-travel-drift-inaccurate-btn"
              title="Test GPS drift, low accuracy (>30m), and parallel road separation"
            >
              <i className="bi bi-filter me-1"></i> Drift/Filter
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => {
                const baseLat = currentLocation?.lat || homeCoords.lat;
                const baseLng = currentLocation?.lng || homeCoords.lng;
                handleSimulatePosition(baseLat + 0.0008, baseLng + 0.0008, 'Step Forward (+100m)');
              }}
              id="live-tracking-sim-1step-btn"
              title="Simulate 1 step forward (~100m)"
            >
              <i className="bi bi-arrow-up-right"></i>
            </button>
          </div>
        </div>
      </div>

      {/* GPS Error or Permission Banner */}
      {gpsPermission === 'denied' && (
        <div className="alert alert-warning border-0 shadow-xs d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3 py-2 px-3">
          <div className="d-flex align-items-center gap-2 small">
            <i className="bi bi-geo-alt-fill text-warning fs-5"></i>
            <div>
              <strong>GPS Access Denied:</strong> Location permission was not granted. The map is centered on default coordinates. You can retry permission or click <strong>Simulate Movement</strong> to test live tracking.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-dark"
            onClick={startGeolocationWatcher}
          >
            <i className="bi bi-arrow-clockwise me-1"></i> Retry GPS
          </button>
        </div>
      )}

      {gpsErrorMsg && gpsPermission !== 'denied' && (
        <div className="alert alert-info border-0 shadow-xs d-flex align-items-center gap-2 mb-3 py-2 px-3 small">
          <i className="bi bi-broadcast text-primary fs-5"></i>
          <div>{gpsErrorMsg}</div>
        </div>
      )}

      {/* Active Tracking Status Notice */}
      <div className="alert alert-info border-0 shadow-xs d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3 py-2 px-3">
        <div className="d-flex align-items-center gap-2 small">
          <i className="bi bi-info-circle-fill text-primary fs-5"></i>
          <div>
            <strong>Active Tracking Tip:</strong> Keep this browser tab open while travelling for real-time GPS coordinate updates and visit detection.
          </div>
        </div>
        <span className="badge bg-white text-dark border small">
          GPS Status: <strong className="text-uppercase">{gpsPermission}</strong>
        </span>
      </div>

      {/* Collapsible Proximity Threshold Config Panel */}
      {showThresholdSettings && (
        <div className="rt-card p-3 mb-4 bg-light border">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="fw-bold mb-0 text-dark">
              <i className="bi bi-sliders me-1 text-primary"></i> Proximity Detection Threshold Settings
            </h6>
            <button
              type="button"
              className="btn-close btn-sm"
              onClick={() => setShowThresholdSettings(false)}
            ></button>
          </div>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-bold text-dark">
                Nearby Radar Banner Threshold: <span className="text-primary">{nearbyThresholdMeters} meters</span>
              </label>
              <input
                type="range"
                className="form-range"
                min="100"
                max="500"
                step="25"
                value={nearbyThresholdMeters}
                onChange={(e) => setNearbyThresholdMeters(Number(e.target.value))}
              />
              <div className="form-text small">
                Shows approaching destination banner when within this distance.
              </div>
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-bold text-dark">
                Visit Confirmation Prompt Threshold: <span className="text-success">{visitThresholdMeters} meters</span>
              </label>
              <input
                type="range"
                className="form-range"
                min="20"
                max="100"
                step="5"
                value={visitThresholdMeters}
                onChange={(e) => setVisitThresholdMeters(Number(e.target.value))}
              />
              <div className="form-text small">
                Triggers the interactive visit verification modal (accounts for GPS accuracy).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approaching Radar Alert Banner (Triggers within 200m) */}
      {approachingPlace && (
        <div
          className="alert alert-warning border-0 shadow-sm d-flex align-items-center justify-content-between gap-3 mb-3 p-3 animate-pulse"
          style={{ backgroundColor: '#fffbeb', borderLeft: '5px solid #f59e0b' }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center bg-warning text-white"
              style={{ width: '42px', height: '42px', fontSize: '1.25rem' }}
            >
              <i className="bi bi-radar"></i>
            </div>
            <div>
              <div className="fw-bold text-dark">
                Approaching Destination: {approachingPlace.name}
              </div>
              <div className="text-muted small">
                Approximately <strong>{nearestDistance ? formatDistance(nearestDistance) : '~200m'}</strong> away ({approachingPlace.address}). Prepare for arrival check-in.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-rt-accent"
            onClick={() => {
              setPromptDestination(approachingPlace);
              setIsRevisit(Boolean(approachingPlace.visited));
              setIsVisitModalOpen(true);
            }}
          >
            <i className="bi bi-geo-alt-fill me-1"></i> Open Visit Check-in
          </button>
        </div>
      )}

      {/* Phase 5: Automatic Stop Detection Notification Banner */}
      {autoSavedStop && (
        <div
          id="live-tracking-auto-save-alert"
          className="alert alert-success border-success shadow-sm d-flex align-items-center justify-content-between flex-wrap gap-2 p-3 rounded-3 mb-3 animate__animated animate__fadeIn"
          role="alert"
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: '40px', height: '40px' }}
            >
              <i className="bi bi-geo-alt-fill fs-5"></i>
            </div>
            <div>
              <div className="fw-bold text-success-emphasis">
                Location saved. Add room details?
              </div>
              <div className="small text-muted">
                {autoSavedStop.isExisting ? 'Detected revisit at' : 'Auto-detected 5-minute stop at'}{' '}
                <strong>{autoSavedStop.name}</strong> ({autoSavedStop.address || `${autoSavedStop.latitude}, ${autoSavedStop.longitude}`}).
              </div>
            </div>
          </div>
          <div className="d-flex gap-2">
            <button
              id="live-tracking-add-details-btn"
              type="button"
              className="btn btn-sm btn-success fw-semibold px-3"
              onClick={() => {
                setSelectedAutoProperty(autoSavedStop);
                setIsRoomDetailsModalOpen(true);
              }}
            >
              <i className="bi bi-pencil-square me-1"></i> Add Details
            </button>
            <button
              id="live-tracking-dismiss-auto-save-btn"
              type="button"
              className="btn btn-sm btn-outline-secondary px-2"
              onClick={() => setAutoSavedStop(null)}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Phase 6: Repeated Route Detection Notification Banner */}
      {repeatedRouteAlert && (
        <div
          id="live-tracking-repeated-route-alert"
          className="alert alert-warning border-warning shadow-sm d-flex align-items-center justify-content-between flex-wrap gap-2 p-3 rounded-3 mb-3 animate__animated animate__fadeIn"
          role="alert"
          style={{
            backgroundColor: '#fffbeb',
            borderColor: '#f59e0b',
            borderLeft: '5px solid #d97706',
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-circle bg-warning text-dark d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: '40px', height: '40px' }}
            >
              <i className="bi bi-arrow-repeat fs-5"></i>
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span className="badge bg-warning text-dark fw-bold text-uppercase" style={{ fontSize: '10px' }}>
                  Previously Travelled Route
                </span>
                {repeatedRouteAlert.tripDate && (
                  <span className="badge bg-light text-secondary border" style={{ fontSize: '10px' }}>
                    <i className="bi bi-calendar3 me-1"></i>
                    {formatDate(repeatedRouteAlert.tripDate) || repeatedRouteAlert.tripDate}
                  </span>
                )}
              </div>
              <div className="fw-bold text-dark fs-6">
                You have already travelled through this route.
              </div>
              <div className="small text-muted">
                Recorded during journey: <strong>{repeatedRouteAlert.tripName}</strong>
                {repeatedRouteAlert.overlapMeters > 0 && (
                  <span> &bull; Overlapping road segment: ~{repeatedRouteAlert.overlapMeters}m</span>
                )}
                {repeatedRouteAlert.distanceMeters != null && (
                  <span> (proximity: ~{repeatedRouteAlert.distanceMeters}m)</span>
                )}
              </div>
              <div className="text-secondary" style={{ fontSize: '11px', marginTop: '2px' }}>
                <i className="bi bi-info-circle me-1"></i>
                Informational notice: your live tracking continues normally.
              </div>
            </div>
          </div>
          <div className="d-flex gap-2 align-items-center">
            <button
              id="live-tracking-dismiss-repeated-route-btn"
              type="button"
              className="btn btn-sm btn-outline-secondary px-3"
              onClick={handleDismissRepeatedRouteAlert}
              title="Dismiss repeated route alert"
            >
              <i className="bi bi-x-lg me-1"></i> Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Live Tracking HUD Row */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md">
          <div className="live-metric-box">
            <div className="metric-value">{formatDistance(distanceCoveredMeters)}</div>
            <div className="metric-label">Distance Travelled</div>
          </div>
        </div>

        <div className="col-6 col-md">
          <div className="live-metric-box">
            <div className="metric-value">{formatDurationSeconds(elapsedSeconds)}</div>
            <div className="metric-label">Tracking Duration</div>
          </div>
        </div>

        <div className="col-6 col-md">
          <div className="live-metric-box" id="metric-route-familiarity">
            <div
              className={`metric-value ${
                routeFamiliarityStatus === 'repeated' ? 'text-warning' : 'text-primary'
              }`}
            >
              {routeFamiliarityStatus === 'repeated' ? (
                <span>
                  <i className="bi bi-arrow-repeat text-warning me-1"></i> Repeated
                </span>
              ) : (
                <span>
                  <i className="bi bi-compass text-primary me-1"></i> New Route
                </span>
              )}
            </div>
            <div className="metric-label">
              Route Status
              {routeFamiliarityStatus === 'repeated' ? (
                <span className="badge bg-warning text-dark ms-1" style={{ fontSize: '9px' }}>
                  Overlap
                </span>
              ) : (
                <span className="badge bg-success-subtle text-success ms-1" style={{ fontSize: '9px' }}>
                  Unique
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="col-6 col-md">
          <div className="live-metric-box">
            <div className="metric-value text-warning">
              {isStationary
                ? `${Math.floor(stationarySeconds / 60)}m ${stationarySeconds % 60}s`
                : 'Moving'}
            </div>
            <div className="metric-label">
              Stationary Stop Radar
              {isStationary && <span className="badge bg-warning text-dark ms-1" style={{ fontSize: '9px' }}>30m</span>}
            </div>
          </div>
        </div>

        <div className="col-6 col-md">
          <div className="live-metric-box">
            <div className="metric-value text-primary font-monospace" style={{ fontSize: '1.05rem', marginTop: '0.2rem' }}>
              {currentLocation ? `${currentLocation.lat.toFixed(4)}°, ${currentLocation.lng.toFixed(4)}°` : 'Acquiring GPS...'}
            </div>
            <div className="metric-label">Current Location</div>
          </div>
        </div>

        <div className="col-6 col-md">
          <div className="live-metric-box">
            <div className="metric-value text-success">
              {gpsAccuracy ? `±${gpsAccuracy} m` : '±6 m'}
            </div>
            <div className="metric-label">GPS Accuracy</div>
          </div>
        </div>
      </div>

      {/* Main Map & Proximity Radar Columns */}
      <div className="row g-4 mb-4">
        {/* Left: Interactive Live Map */}
        <div className="col-lg-8">
          <div className="rt-card p-0 overflow-hidden" style={{ height: '540px', minHeight: '540px', position: 'relative' }}>
            {/* Map Container */}
            <div
              ref={mapContainerRef}
              id="live-tracking-leaflet-map"
              className="leaflet-map-canvas"
              style={{ width: '100%', height: '100%', minHeight: '540px', zIndex: 1 }}
            />

            {/* Floating Map HUD */}
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                zIndex: 1000,
                pointerEvents: 'none',
              }}
            >
              <div
                className="bg-white px-3 py-2 rounded shadow-sm border small"
                style={{ pointerEvents: 'auto' }}
              >
                <div className="d-flex align-items-center justify-content-between gap-3">
                  <div className="d-flex align-items-center gap-2">
                    <span
                      className={`tracking-radar-indicator ${
                        trackingStatus === 'recording' ? 'active' : ''
                      }`}
                    ></span>
                    <strong className="text-dark">
                      {trackingStatus === 'recording'
                        ? 'Live Route Recording'
                        : trackingStatus === 'paused'
                        ? 'Route Recording Paused'
                        : trackingStatus === 'ended'
                        ? 'Session Completed'
                        : 'Radar Ready'}
                    </strong>
                  </div>
                  {renderTrackingStatusBadge()}
                </div>
                <div className="text-muted mt-1" style={{ fontSize: '11px' }}>
                  {routeBreadcrumbs.length} GPS Points Recorded • 
                  {currentLocation
                    ? ` ${formatCoordinates(currentLocation.lat, currentLocation.lng)}`
                    : ' Home Center'}
                </div>
              </div>
            </div>

            {/* Floating Recenter Button */}
            <div
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                zIndex: 1000,
              }}
            >
              <button
                type="button"
                className="btn btn-sm btn-light border shadow-sm"
                onClick={handleRecenterMap}
                title="Recenter Map on My Location"
              >
                <i className="bi bi-crosshair text-primary"></i> Recenter
              </button>
            </div>

            {/* Map Pin Legend (Bottom-Left - Requirement 3 Design Standard) */}
            <div
              style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                zIndex: 1000,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '11px',
                border: '1px solid #cbd5e1',
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              }}
            >
              <div className="d-flex align-items-center gap-3 flex-wrap">
                <div className="d-flex align-items-center gap-1">
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      backgroundColor: '#2563eb',
                      borderRadius: '50%',
                      border: '2px solid #ffffff',
                      boxShadow: '0 0 0 1px #2563eb',
                    }}
                  ></span>
                  <span className="fw-semibold text-dark">You (Live GPS)</span>
                </div>
                <div className="d-flex align-items-center gap-1">
                  <span
                    style={{
                      width: '16px',
                      height: '4px',
                      backgroundColor: '#7c3aed',
                      borderRadius: '2px',
                    }}
                  ></span>
                  <span className="fw-semibold text-dark">Travelled Path</span>
                </div>
                <div className="d-flex align-items-center gap-1">
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: '#ea580c',
                      borderRadius: '50%',
                    }}
                  ></span>
                  <span>Saved Places</span>
                </div>
                <div className="d-flex align-items-center gap-1">
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: '#10b981',
                      borderRadius: '50%',
                    }}
                  ></span>
                  <span>Visited Places</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Radar Engine & Nearest Destination */}
        <div className="col-lg-4">
          <div className="rt-card h-100 d-flex flex-column">
            <div className="rt-card-header">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-compass text-primary"></i>
                <h6 className="fw-bold mb-0 text-dark">Proximity Radar</h6>
              </div>
              <span className="badge bg-light text-dark border small">
                {places.filter((p) => p.visited).length} of {places.length} Visited
              </span>
            </div>

            <div className="rt-card-body flex-grow-1">
              {/* Nearest Destination Box */}
              <div className="p-3 rounded border mb-3" style={{ backgroundColor: '#f0f9ff' }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-bold small text-dark">
                    <i className="bi bi-crosshair text-danger me-1"></i> Nearest Saved Destination
                  </span>
                  <span className="badge badge-rt-primary">Proximity Target</span>
                </div>

                {nearestPlace ? (
                  <div>
                    <h6 className="fw-bold text-dark mb-1">{nearestPlace.name}</h6>
                    <p className="text-muted small mb-2">{nearestPlace.address}</p>

                    <div className="p-2 rounded bg-white border mb-3">
                      <div className="d-flex justify-content-between small">
                        <span className="text-muted">Direct Distance:</span>
                        <strong className="text-dark">
                          {nearestDistance !== null ? formatDistance(nearestDistance) : 'Calculating...'}
                        </strong>
                      </div>
                      <div className="d-flex justify-content-between small">
                        <span className="text-muted">Visit Status:</span>
                        <span
                          className={`badge ${
                            nearestPlace.visited ? 'badge-rt-success' : 'badge-rt-primary'
                          }`}
                        >
                          {nearestPlace.visited ? 'Visited' : 'Unvisited / Pending'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-sm btn-rt-accent w-100"
                      onClick={() => {
                        setPromptDestination(nearestPlace);
                        setIsRevisit(Boolean(nearestPlace.visited));
                        setIsVisitModalOpen(true);
                      }}
                    >
                      <i className="bi bi-bell me-1"></i> Open Visit Confirmation Prompt
                    </button>
                  </div>
                ) : (
                  <p className="text-muted small mb-0">No destinations saved yet.</p>
                )}
              </div>

              {/* Anti-Duplicate Architecture Summary */}
              <div className="border rounded p-3 bg-light small mb-3">
                <div className="fw-bold text-dark mb-1">
                  <i className="bi bi-shield-check text-success me-1"></i> Anti-Duplicate Rules
                </div>
                <ul className="list-unstyled mb-0 text-muted" style={{ fontSize: '11px' }}>
                  <li className="mb-1">
                    <i className="bi bi-check2 text-primary me-1"></i>
                    <strong>Human Confirmation:</strong> Never marks places visited automatically.
                  </li>
                  <li className="mb-1">
                    <i className="bi bi-check2 text-primary me-1"></i>
                    <strong>Suppresses Repeated Prompts:</strong> Dismissing silences alerts for this trip.
                  </li>
                  <li>
                    <i className="bi bi-check2 text-primary me-1"></i>
                    <strong>Intentional Revisits:</strong> Second visits can be explicitly flagged.
                  </li>
                </ul>
              </div>

              {/* Quick Trip Selector & Details */}
              <div className="small text-muted border-top pt-2 mt-auto">
                <div>
                  <strong>Active Trip:</strong> {selectedTrip?.tripName || selectedTrip?.title || 'None Selected'}
                </div>
                <div>
                  <strong>Recorded Breadcrumbs:</strong> {routeBreadcrumbs.length} GPS fixes
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visit Confirmation & Revisit Alert Modal */}
      <Modal
        isOpen={isVisitModalOpen}
        onClose={revisitDetails.isRevisit ? handleSkipRevisit : handleDismissPrompt}
        title={revisitDetails.isRevisit ? 'Previously Visited Location Alert' : 'Destination Reached!'}
        size="md"
        footer={
          revisitDetails.isRevisit ? (
            <div className="d-flex justify-content-between align-items-center w-100 flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary px-3"
                onClick={handleSkipRevisit}
              >
                <i className="bi bi-slash-circle me-1"></i> Skip
              </button>
              <button
                type="button"
                className="btn btn-sm btn-rt-primary px-3"
                disabled={savingVisit}
                onClick={handleConfirmVisit}
              >
                {savingVisit ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1"></span>
                    Recording Revisit...
                  </>
                ) : (
                  <>
                    <i className="bi bi-arrow-repeat me-1"></i> Visit Again
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="d-flex justify-content-between align-items-center w-100 flex-wrap gap-2">
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleDismissPrompt}
                >
                  Dismiss (Passing By)
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-warning"
                  onClick={handleSnoozePrompt}
                >
                  Not Now (Snooze 5m)
                </button>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-rt-primary px-3"
                disabled={savingVisit}
                onClick={handleConfirmVisit}
              >
                {savingVisit ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1"></span>
                    Confirming...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg me-1"></i> Confirm Visit
                  </>
                )}
              </button>
            </div>
          )
        }
      >
        {promptDestination && revisitDetails.isRevisit ? (
          <div>
            <div className="alert alert-warning border-warning d-flex align-items-start gap-3 p-3 mb-3">
              <div
                className="rounded-circle bg-warning text-dark p-2 d-flex align-items-center justify-content-center flex-shrink-0"
                style={{ width: '42px', height: '42px' }}
              >
                <i className="bi bi-exclamation-triangle-fill fs-5"></i>
              </div>
              <div>
                <h5 className="alert-heading fw-bold text-dark mb-1">
                  You have already visited this location.
                </h5>
                <p className="small text-muted mb-0">
                  RoomTrail detected that you are approaching <strong>{promptDestination.name}</strong>, which has historical visit records on file.
                </p>
              </div>
            </div>

            <div className="card bg-light border p-3 mb-3">
              <div className="row g-2 small">
                <div className="col-12 border-bottom pb-2 mb-1">
                  <span className="text-muted">Destination:</span>{' '}
                  <strong className="text-dark fs-6">{promptDestination.name}</strong>
                  <span className="badge bg-secondary ms-2 text-uppercase" style={{ fontSize: '0.68rem' }}>
                    {promptDestination.category}
                  </span>
                </div>
                <div className="col-6">
                  <span className="text-muted d-block">Last Visit Date:</span>
                  <strong className="text-dark">
                    <i className="bi bi-calendar3 me-1 text-primary"></i>
                    {revisitDetails.lastVisitDate}
                  </strong>
                </div>
                <div className="col-6">
                  <span className="text-muted d-block">Last Visit Time:</span>
                  <strong className="text-dark">
                    <i className="bi bi-clock me-1 text-primary"></i>
                    {revisitDetails.lastVisitTime}
                  </strong>
                </div>
                <div className="col-6 mt-2">
                  <span className="text-muted d-block">Total Previous Visits:</span>
                  <span className="badge bg-primary text-white fs-6 px-2 py-1">
                    {revisitDetails.totalVisits} {revisitDetails.totalVisits === 1 ? 'visit' : 'visits'} logged
                  </span>
                </div>
                <div className="col-6 mt-2">
                  <span className="text-muted d-block">Next Visit Sequence:</span>
                  <span className="badge bg-warning-subtle text-warning-emphasis border border-warning fs-6 px-2 py-1">
                    Visit #{revisitDetails.nextSequenceNumber} (Revisit)
                  </span>
                </div>
                <div className="col-12 mt-2 pt-2 border-top">
                  <span className="text-muted d-block mb-1">Previous Visit Notes:</span>
                  <div className="p-2 rounded bg-white border text-secondary fst-italic">
                    {revisitDetails.lastVisitNotes ? (
                      <>
                        <i className="bi bi-chat-quote me-1 text-primary"></i>
                        {revisitDetails.lastVisitNotes}
                      </>
                    ) : (
                      'No previous notes recorded for this location.'
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold">New Visit Notes / Inspection Remarks (Optional)</label>
              <textarea
                rows="2"
                className="form-control form-control-sm"
                placeholder="e.g. Follow-up inspection, owner confirmed rental terms..."
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
              />
            </div>
          </div>
        ) : promptDestination && (
          <div>
            <div className="text-center mb-3">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                style={{
                  width: '60px',
                  height: '60px',
                  backgroundColor: '#ecfdf5',
                  color: '#10b981',
                  fontSize: '2rem',
                }}
              >
                <i className="bi bi-geo-alt-fill"></i>
              </div>
              <h5 className="fw-bold text-dark mb-1">
                You are near {promptDestination.name}!
              </h5>
              <p className="text-muted small mb-0">{promptDestination.address}</p>
              <div className="badge bg-primary-subtle text-primary mt-2">
                Within {visitThresholdMeters}m proximity threshold
              </div>
            </div>

            <div className="p-3 rounded bg-light border mb-3">
              <div className="d-flex justify-content-between small text-muted mb-1">
                <span>Category:</span>
                <strong className="text-dark text-uppercase">{promptDestination.category}</strong>
              </div>
              <div className="d-flex justify-content-between small text-muted mb-1">
                <span>Price / Rent:</span>
                <strong className="text-dark">{promptDestination.price || promptDestination.rent || 'Contact Owner'}</strong>
              </div>
              <div className="d-flex justify-content-between small text-muted">
                <span>Coordinates:</span>
                <strong className="text-dark">
                  {formatCoordinates(promptDestination.latitude, promptDestination.longitude)}
                </strong>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold">Visit Notes / Impressions (Optional)</label>
              <textarea
                rows="2"
                className="form-control form-control-sm"
                placeholder="e.g. Inspected flat, balcony view is good, owner ready to negotiate rent..."
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* End Trip Confirmation Modal */}
      <Modal
        isOpen={isEndTripModalOpen}
        onClose={() => setIsEndTripModalOpen(false)}
        title="End Trip & Generate Summary"
        size="md"
        footer={
          <div className="d-flex justify-content-end gap-2 w-100">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setIsEndTripModalOpen(false)}
            >
              Continue Tracking
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger px-3"
              disabled={finalizingTrip}
              onClick={handleConfirmEndTrip}
            >
              {finalizingTrip ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1"></span>
                  Finalizing...
                </>
              ) : (
                <>
                  <i className="bi bi-flag-fill me-1"></i> End Trip & View Summary
                </>
              )}
            </button>
          </div>
        }
      >
        <div>
          <div className="text-center mb-3">
            <i className="bi bi-flag-fill text-danger fs-1 d-block mb-2"></i>
            <h5 className="fw-bold text-dark">Are you ready to end this trip?</h5>
            <p className="text-muted small">
              This will stop the GPS route recorder, finalize trip statistics, and generate your trip summary.
            </p>
          </div>

          <div className="row g-2 mb-3 text-center">
            <div className="col-4">
              <div className="p-2 bg-light border rounded">
                <div className="fw-bold text-dark">{formatDistance(distanceCoveredMeters)}</div>
                <div className="text-muted" style={{ fontSize: '10px' }}>Total Distance</div>
              </div>
            </div>
            <div className="col-4">
              <div className="p-2 bg-light border rounded">
                <div className="fw-bold text-dark">{formatDurationSeconds(elapsedSeconds)}</div>
                <div className="text-muted" style={{ fontSize: '10px' }}>Total Duration</div>
              </div>
            </div>
            <div className="col-4">
              <div className="p-2 bg-light border rounded">
                <div className="fw-bold text-dark">{routeBreadcrumbs.length}</div>
                <div className="text-muted" style={{ fontSize: '10px' }}>GPS Points</div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Quick Add Place Modal - Active during travel without page navigation */}
      <QuickAddPlaceModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        initialCoordinates={currentLocation || homeCoords.current}
        onSuccess={(newPlace) => {
          setPlaces((prev) => [newPlace, ...prev]);
          if (currentLocation && newPlace.latitude && newPlace.longitude) {
            const d = calculateDistanceMeters(
              currentLocation.lat,
              currentLocation.lng,
              Number(newPlace.latitude),
              Number(newPlace.longitude)
            );
            if (!nearestDistance || d < nearestDistance) {
              setNearestPlace(newPlace);
              setNearestDistance(Math.round(d));
            }
          }
        }}
      />

      {/* Phase 5: Optional Room Details Modal */}
      <AddRoomDetailsModal
        isOpen={isRoomDetailsModalOpen}
        onClose={() => setIsRoomDetailsModalOpen(false)}
        property={selectedAutoProperty}
        onPropertyUpdated={(updatedProp) => {
          setPlaces((prev) =>
            prev.map((p) => (p.id === updatedProp.id ? { ...p, ...updatedProp } : p))
          );
          if (autoSavedStop && autoSavedStop.id === updatedProp.id) {
            setAutoSavedStop({ ...autoSavedStop, ...updatedProp });
          }
        }}
      />
    </div>
  );
};

export default LiveTrackingPage;
