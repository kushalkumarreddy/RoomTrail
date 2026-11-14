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
} from '../../services';
import Modal from '../../components/common/Modal';
import QuickAddPlaceModal from '../../components/places/QuickAddPlaceModal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  formatDate,
  formatDistance,
  calculateDistanceMeters,
  formatDurationSeconds,
  formatCoordinates,
  getCategoryIcon,
} from '../../utils/formatters';

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

  // Home base fallback coordinates
  const homeCoords = useRef({
    lat: user?.homeCoordinates?.lat || 12.9716,
    lng: user?.homeCoordinates?.lng || 77.5946,
  }).current;

  // 1. Initial Data Fetching & Active Session Restoration
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [placesData, tripsData, visitsData] = await Promise.all([
        propertyService.getAll(),
        tripService.getAll(),
        visitService.getAll().catch(() => []),
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

      // Session Restoration: Check for saved tracking session in localStorage
      let restored = false;
      const savedSessionStr = localStorage.getItem('roomtrail_active_tracking_session');
      if (savedSessionStr) {
        try {
          const session = JSON.parse(savedSessionStr);
          if (session?.tripId) {
            const matchedTrip = userTrips.find((t) => t.id === session.tripId);
            if (matchedTrip && matchedTrip.status !== 'completed') {
              setSelectedTrip(matchedTrip);
              setElapsedSeconds(session.elapsedSeconds || 0);
              setDistanceCoveredMeters(session.distanceCoveredMeters || 0);

              // Restore route points for this trip
              const savedPoints = await routePointService.getByTripId(session.tripId);
              if (savedPoints && savedPoints.length > 0) {
                const crumbs = savedPoints.map((p) => ({
                  lat: p.latitude,
                  lng: p.longitude,
                  accuracy: p.accuracy || 8,
                  speed: p.speed || 0,
                  timestamp: p.timestamp,
                  recordedAt: new Date(p.timestamp).getTime(),
                }));
                setRouteBreadcrumbs(crumbs);
                lastRecordedPointRef.current = crumbs[crumbs.length - 1];
                setCurrentLocation({
                  lat: crumbs[crumbs.length - 1].lat,
                  lng: crumbs[crumbs.length - 1].lng,
                  accuracy: crumbs[crumbs.length - 1].accuracy,
                });
              }

              if (session.status === 'recording' || session.status === 'paused') {
                setTrackingStatus(session.status);
              }
              restored = true;
            }
          }
        } catch (e) {
          console.warn('Failed to parse saved tracking session', e);
        }
      }

      if (!restored) {
        // Select active trip if one exists, or the first trip
        const active = userTrips.find((t) => t.status === 'active');
        if (active) {
          setSelectedTrip(active);
          try {
            const points = await routePointService.getByTripId(active.id);
            if (points && points.length > 0) {
              const crumbs = points.map((p) => ({
                lat: p.latitude,
                lng: p.longitude,
                accuracy: p.accuracy || 8,
                speed: p.speed || 0,
                timestamp: p.timestamp,
                recordedAt: new Date(p.timestamp).getTime(),
              }));
              setRouteBreadcrumbs(crumbs);
              lastRecordedPointRef.current = crumbs[crumbs.length - 1];
            }
          } catch (e) {
            console.warn('Failed to load active trip points', e);
          }
        } else if (userTrips.length > 0) {
          setSelectedTrip(userTrips[0]);
        }
      }
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

  // 2b. Sync Travelled Path Polyline with routeBreadcrumbs
  useEffect(() => {
    if (!leafletMapInstance.current || !routePolylineRef.current) return;
    if (routeBreadcrumbs && routeBreadcrumbs.length > 0) {
      const latLngs = routeBreadcrumbs.map((pt) => [pt.lat, pt.lng]);
      routePolylineRef.current.setLatLngs(latLngs);
    } else {
      routePolylineRef.current.setLatLngs([]);
    }
  }, [routeBreadcrumbs, loading]);

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

  // 6. Coordinate Processing Pipeline with Robust GPS Filtering (Requirement 4)
  const processNewCoordinate = useCallback(
    async (coords) => {
      if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return;

      // Update current live location display and user marker on map
      setCurrentLocation(coords);
      setGpsAccuracy(coords.accuracy || 6);
      updateUserOnMap(coords);

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
          // 1. Duplicate coordinate check
          if (last.lat === coords.lat && last.lng === coords.lng) {
            shouldRecord = false;
          } else {
            stepDist = calculateDistanceMeters(last.lat, last.lng, coords.lat, coords.lng);
            const timeDeltaSec = Math.max(0.1, (Date.now() - (last.recordedAt || Date.now())) / 1000);
            const apparentSpeedMps = stepDist / timeDeltaSec;

            // 2. Sudden GPS Jump / Glitch Filter:
            // Discard unrealistically fast jumps (> 55 m/s or ~200 km/h with distance > 300m)
            const isSuddenJump = stepDist > 300 && apparentSpeedMps > 55;

            // 3. Accuracy Filter:
            // Inaccurate readings (> 45m accuracy buffer) are not appended to the route path
            const isPoorAccuracy = coords.accuracy && coords.accuracy > 45;

            // 4. Movement Threshold:
            // Require displacement >= 3 meters, or periodic heartbeat after 30 seconds
            const isMeaningfulMovement = stepDist >= 3 || timeDeltaSec > 30;

            if (!isSuddenJump && !isPoorAccuracy && isMeaningfulMovement) {
              shouldRecord = true;
              if (stepDist >= 3) {
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
          const breadcrumb = {
            lat: coords.lat,
            lng: coords.lng,
            accuracy: coords.accuracy || 8,
            speed: coords.speed || 0,
            timestamp: new Date().toISOString(),
            recordedAt: Date.now(),
          };

          lastRecordedPointRef.current = breadcrumb;

          setRouteBreadcrumbs((prev) => {
            const updated = [...prev, breadcrumb];
            // Directly update map polyline for instantaneous path visualization
            if (routePolylineRef.current) {
              routePolylineRef.current.setLatLngs(updated.map((pt) => [pt.lat, pt.lng]));
            }
            return updated;
          });

          // Pan map to follow movement smoothly
          if (leafletMapInstance.current) {
            leafletMapInstance.current.panTo([coords.lat, coords.lng]);
          }

          // Asynchronously persist route point to backend
          if (selectedTrip?.id) {
            try {
              await routePointService.create({
                tripId: selectedTrip.id,
                latitude: coords.lat,
                longitude: coords.lng,
                accuracy: coords.accuracy || 8,
                speed: coords.speed || 0,
                timestamp: breadcrumb.timestamp,
              });
            } catch (err) {
              console.warn('Failed to persist route breadcrumb point', err);
            }
          }
        }
      }

      // Run proximity evaluation
      evaluateProximity(coords);
    },
    [trackingStatus, selectedTrip, updateUserOnMap, evaluateProximity, syncSessionToStorage]
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
    if (!tripToUse) {
      try {
        const created = await tripService.create({
          userId: user?.id || '1',
          tripName: `Live Tracking Tour - ${new Date().toLocaleDateString()}`,
          startLocation: 'Current GPS Location',
          status: 'active',
          travelMode: user?.travelMode || 'car',
        });
        tripToUse = created;
        setSelectedTrip(created);
        setTrips((prev) => [created, ...prev]);
      } catch (err) {
        console.error('Failed to create automatic trip', err);
      }
    } else if (tripToUse.status !== 'active') {
      try {
        await tripService.update(tripToUse.id, { status: 'active' });
        tripToUse.status = 'active';
      } catch (err) {
        console.warn('Failed to update trip status to active', err);
      }
    }

    setTrackingStatus('recording');
    syncSessionToStorage({ status: 'recording', tripId: tripToUse?.id });
    startGeolocationWatcher();

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
      if (selectedTrip?.id) {
        await tripService.update(selectedTrip.id, {
          status: 'completed',
          endTime: now,
          totalDistance: formattedDist,
          totalDuration: formattedDur,
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

  // Expose simulation helpers on window for automated testing without UI clutter
  useEffect(() => {
    window.roomtrailSimulate = {
      position: handleSimulatePosition,
      towardsPlace: handleSimulateTowardsPlace,
      multiStep: handleSimulateMultiStepPath,
    };
    return () => {
      delete window.roomtrailSimulate;
    };
  }, [currentLocation, places]);

  // Clean up timer and watcher on unmount
  useEffect(() => {
    return () => {
      stopGeolocationWatcher();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
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
    if (gpsPermission === 'prompt' || !currentLocation) {
      return (
        <span className="badge-rt tracking-badge-waiting" title="Acquiring GPS location lock">
          <i className="bi bi-geo-alt text-warning"></i>
          Waiting for GPS
        </span>
      );
    }
    return (
      <span className="badge-rt tracking-badge-idle" title="Trip tracking is idle">
        <i className="bi bi-circle text-muted"></i>
        Not Tracking
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
            >
              <i className="bi bi-play-fill me-1"></i> Start Trip Tracking
            </button>
          )}

          {trackingStatus === 'recording' && (
            <>
              <button
                type="button"
                className="btn btn-sm btn-outline-warning px-3"
                onClick={handlePauseTrip}
              >
                <i className="bi bi-pause-fill me-1"></i> Pause
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger px-3"
                onClick={handleEndTripPrompt}
              >
                <i className="bi bi-stop-fill me-1"></i> End Trip
              </button>
            </>
          )}

          {trackingStatus === 'paused' && (
            <>
              <button
                type="button"
                className="btn btn-sm btn-rt-primary px-3"
                onClick={handleStartTrip}
              >
                <i className="bi bi-play-fill me-1"></i> Resume Tracking
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger px-3"
                onClick={handleEndTripPrompt}
              >
                <i className="bi bi-stop-fill me-1"></i> End Trip
              </button>
            </>
          )}

          {trackingStatus === 'ended' && (
            <button
              type="button"
              className="btn btn-sm btn-rt-secondary px-3"
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
        </div>
      </div>

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

      {/* Live Tracking HUD Row */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="live-metric-box">
            <div className="metric-value">{formatDistance(distanceCoveredMeters)}</div>
            <div className="metric-label">Distance Covered</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="live-metric-box">
            <div className="metric-value">{formatDurationSeconds(elapsedSeconds)}</div>
            <div className="metric-label">Elapsed Time</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="live-metric-box">
            <div className="metric-value">{currentSpeedKmh} km/h</div>
            <div className="metric-label">Speed (Max {maxSpeedKmh} km/h)</div>
          </div>
        </div>

        <div className="col-6 col-md-3">
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
    </div>
  );
};

export default LiveTrackingPage;
