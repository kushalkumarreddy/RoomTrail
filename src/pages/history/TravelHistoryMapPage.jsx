import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import {
  tripService,
  propertyService,
  visitService,
  routePointService,
  routingService,
} from '../../services';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import {
  formatDate,
  formatDateTime,
  formatDistance,
  formatCoordinates,
  getCategoryIcon,
} from '../../utils/formatters';
import { isValidCoordinate } from '../../utils/validators';

const TravelHistoryMapPage = () => {
  const [searchParams] = useSearchParams();
  const tripIdParam = searchParams.get('tripId');
  const { user } = useAuth();
  const { showError, showInfo } = useNotification();
  const navigate = useNavigate();

  // Primary Data
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [tripVisits, setTripVisits] = useState([]);
  const [historicalGpsPoints, setHistoricalGpsPoints] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter trips by date
  const [tripDateFilter, setTripDateFilter] = useState('');

  // Mode Selection: 'historical' | 'planned' (Feature 5)
  const [routeMode, setRouteMode] = useState('historical');

  // Planned Route OSRM State (Feature 4)
  const [plannedRouteData, setPlannedRouteData] = useState(null);
  const [plannedRouteLoading, setPlannedRouteLoading] = useState(false);
  const [plannedRouteError, setPlannedRouteError] = useState(null);

  // Map Refs
  const mapContainerRef = useRef(null);
  const leafletMapInstance = useRef(null);
  const markersLayerRef = useRef(null);
  const polylineLayerRef = useRef(null);

  // 1. Load All Trips
  useEffect(() => {
    const loadTrips = async () => {
      setLoading(true);
      try {
        const allTrips = await tripService.getAll();
        const userTrips = user?.id
          ? allTrips.filter((t) => !t.userId || t.userId === user.id)
          : allTrips;
        setTrips(userTrips);

        let target = null;
        if (tripIdParam) {
          target = userTrips.find((t) => t.id === tripIdParam);
        }
        if (!target && userTrips.length > 0) {
          // Prefer completed or active trip, else first
          target = userTrips.find((t) => t.status === 'completed') || userTrips[0];
        }
        setSelectedTrip(target || null);
      } catch (err) {
        console.error('Failed to load trips for history map', err);
        showError('Failed to load travel history trips.');
      } finally {
        setLoading(false);
      }
    };

    loadTrips();
  }, [user, tripIdParam]);

  // 2. Load Trip Details (Visits & Recorded GPS Breadcrumbs)
  const loadTripDetails = useCallback(async (trip) => {
    if (!trip?.id) {
      setTripVisits([]);
      setHistoricalGpsPoints([]);
      setPlannedRouteData(null);
      return;
    }

    try {
      const [visitsData, pointsData] = await Promise.all([
        visitService.getAll().catch(() => []),
        routePointService.getByTripId(trip.id).catch(() => []),
      ]);

      // Linked visits
      const linked = visitsData.filter(
        (v) =>
          v.tripId === trip.id ||
          trip.destinations?.some(
            (d) => d.id === v.destinationId || d.id === v.propertyId
          )
      );
      setTripVisits(linked);

      // Sorted historical GPS points
      const sortedPoints = [...pointsData].sort(
        (a, b) => new Date(a.timestamp || a.recordedAt || 0) - new Date(b.timestamp || b.recordedAt || 0)
      );
      setHistoricalGpsPoints(sortedPoints);
      setPlannedRouteData(null);
      setPlannedRouteError(null);
    } catch (err) {
      console.warn('Failed to load detailed trip logs', err);
    }
  }, []);

  useEffect(() => {
    if (selectedTrip) {
      loadTripDetails(selectedTrip);
    }
  }, [selectedTrip, loadTripDetails]);

  // 3. Initialize Base Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || loading) return;

    if (!leafletMapInstance.current) {
      const map = L.map(mapContainerRef.current, {
        center: [12.9716, 77.5946],
        zoom: 13,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      polylineLayerRef.current = L.layerGroup().addTo(map);
      leafletMapInstance.current = map;

      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    }
  }, [loading]);

  // 4. Render Map for Current Selected Trip and Mode
  const renderMapRoute = useCallback(async () => {
    if (!leafletMapInstance.current || !selectedTrip) return;

    const map = leafletMapInstance.current;
    const markersGroup = markersLayerRef.current;
    const polylineGroup = polylineLayerRef.current;

    markersGroup.clearLayers();
    polylineGroup.clearLayers();

    const startLat = selectedTrip.startCoordinates?.lat || selectedTrip.startLat || 12.9716;
    const startLng = selectedTrip.startCoordinates?.lng || selectedTrip.startLng || 77.5946;
    const endLat = selectedTrip.endCoordinates?.lat || selectedTrip.endLat || 12.9784;
    const endLng = selectedTrip.endCoordinates?.lng || selectedTrip.endLng || 77.6408;

    // A. Start Marker
    const startIcon = L.divIcon({
      className: 'custom-start-marker',
      html: `
        <div style="background-color: #0b192c; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 8px rgba(0,0,0,0.3); color: #ffffff;">
          <i class="bi bi-geo-alt-fill" style="font-size: 15px;"></i>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    L.marker([startLat, startLng], { icon: startIcon, zIndexOffset: 900 })
      .bindPopup(`
        <div style="font-size: 12px;">
          <strong style="color: #0b192c;">Original Starting Point</strong><br/>
          <span>${selectedTrip.startLocation || 'Base Location'}</span><br/>
          <span class="text-muted font-monospace">${startLat.toFixed(4)}°, ${startLng.toFixed(4)}°</span>
        </div>
      `)
      .addTo(markersGroup);

    // B. Destination Markers
    const destinations = selectedTrip.destinations || [];
    destinations.forEach((dest, idx) => {
      const lat = dest.latitude || dest.lat;
      const lng = dest.longitude || dest.lng;
      if (!isValidCoordinate(lat, lng)) return;

      const stopSeq = idx + 1;
      const isVisited = dest.visited || tripVisits.some((v) => v.destinationId === dest.id || v.propertyId === dest.id);

      const destIcon = L.divIcon({
        className: 'custom-stop-marker',
        html: `
          <div class="stop-number-pin ${isVisited ? 'visited' : 'pending'}" style="width: 28px; height: 28px; font-weight: bold; font-size: 13px;">
            ${stopSeq}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker([lat, lng], { icon: destIcon, zIndexOffset: 800 })
        .bindPopup(`
          <div style="font-size: 12px;">
            <strong style="color: #0b192c;">Stop ${stopSeq}: ${dest.name}</strong><br/>
            <span class="text-muted">${dest.address || ''}</span><br/>
            <span class="badge ${isVisited ? 'bg-success' : 'bg-primary'} mt-1">
              ${isVisited ? 'Confirmed Visited' : 'Planned Stop'}
            </span>
          </div>
        `)
        .addTo(markersGroup);
    });

    // C. End Marker
    const endIcon = L.divIcon({
      className: 'custom-end-marker',
      html: `
        <div style="background-color: #ef4444; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 8px rgba(0,0,0,0.3); color: #ffffff;">
          <i class="bi bi-flag-fill" style="font-size: 13px;"></i>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker([endLat, endLng], { icon: endIcon, zIndexOffset: 850 })
      .bindPopup(`
        <div style="font-size: 12px;">
          <strong style="color: #ef4444;">Original Final Destination</strong><br/>
          <span>${selectedTrip.endLocation || 'Final Stop'}</span><br/>
          <span class="text-muted font-monospace">${endLat.toFixed(4)}°, ${endLng.toFixed(4)}°</span>
        </div>
      `)
      .addTo(markersGroup);

    // D. MODE A: HISTORICAL ROUTE (Actual Recorded GPS Path)
    if (routeMode === 'historical') {
      if (historicalGpsPoints && historicalGpsPoints.length >= 2) {
        const polylineCoords = historicalGpsPoints.map((pt) => [pt.latitude, pt.longitude]);

        // Actual Travelled GPS Path: Purple (#7c3aed) - Permanent Design Standard
        const polyline = L.polyline(polylineCoords, {
          color: '#7c3aed',
          weight: 5,
          opacity: 0.9,
          lineJoin: 'round',
        }).addTo(polylineGroup);

        // Add small circle markers for intermediate GPS breadcrumbs with sequence numbers
        historicalGpsPoints.forEach((pt, index) => {
          const circle = L.circleMarker([pt.latitude, pt.longitude], {
            radius: 4,
            fillColor: '#6d28d9',
            color: '#ffffff',
            weight: 1.5,
            fillOpacity: 0.9,
          }).addTo(polylineGroup);

          const seq = pt.sequenceNumber || index + 1;
          const time = pt.timestamp || pt.recordedAt || '';
          circle.bindPopup(`
            <div style="font-size: 11px;">
              <strong>Breadcrumb #${seq}</strong><br/>
              <span>Time: ${time ? new Date(time).toLocaleTimeString() : 'Recorded'}</span><br/>
              <span>Speed: ${pt.speed ? Math.round(pt.speed * 3.6) + ' km/h' : '0 km/h'}</span><br/>
              <span class="text-muted">Coords: ${pt.latitude.toFixed(5)}°, ${pt.longitude.toFixed(5)}°</span>
            </div>
          `);
        });

        map.fitBounds(polyline.getBounds(), { padding: [40, 40], maxZoom: 16 });
      } else {
        // Fallback view: center on start
        map.setView([startLat, startLng], 13);
      }
    }

    // E. MODE B: PLANNED ROUTE (OSRM Real Road Geometry)
    if (routeMode === 'planned') {
      const waypoints = [
        { lat: startLat, lng: startLng, name: selectedTrip.startLocation || 'Start' },
        ...destinations
          .filter((d) => isValidCoordinate(d.latitude || d.lat, d.longitude || d.lng))
          .map((d) => ({
            lat: d.latitude || d.lat,
            lng: d.longitude || d.lng,
            name: d.name,
          })),
        { lat: endLat, lng: endLng, name: selectedTrip.endLocation || 'End' },
      ];

      if (waypoints.length >= 2) {
        setPlannedRouteLoading(true);
        setPlannedRouteError(null);

        try {
          const multiRoute = await routingService.getMultiStopRoadRoute({
            waypoints,
            profile: selectedTrip.travelMode || 'driving',
          });

          setPlannedRouteData(multiRoute);

          // Sky Blue polyline for planned road path
          const polyline = L.polyline(multiRoute.coordinates, {
            color: '#0284c7',
            weight: 5,
            opacity: 0.85,
            lineJoin: 'round',
            dashArray: '1, 8', // Distinct visual appearance
          }).addTo(polylineGroup);

          map.fitBounds(polyline.getBounds(), { padding: [40, 40], maxZoom: 16 });
        } catch (err) {
          console.error('OSRM planned route calculation failed', err);
          setPlannedRouteError(
            err.message || 'Road routing service is currently unavailable. Please verify internet connectivity.'
          );
        } finally {
          setPlannedRouteLoading(false);
        }
      }
    }
  }, [selectedTrip, routeMode, historicalGpsPoints, tripVisits]);

  useEffect(() => {
    if (!loading && leafletMapInstance.current) {
      renderMapRoute();
    }
  }, [loading, renderMapRoute]);

  // Filtered trips list by date
  const filteredTrips = useMemo(() => {
    if (!tripDateFilter) return trips;
    return trips.filter((t) => {
      const date = t.scheduledDate || t.startTime || t.createdAt || '';
      return date.startsWith(tripDateFilter);
    });
  }, [trips, tripDateFilter]);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Travel History Map</h2>
          <p className="page-subtitle">
            View past journeys, recorded GPS breadcrumb paths, and road routes
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Link to="/history" className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-clock-history"></i> Visit History
          </Link>
          <Link to="/trips" className="btn btn-rt-secondary btn-sm">
            <i className="bi bi-signpost-split"></i> My Trips
          </Link>
          <Link to="/trip-summary" className="btn btn-rt-primary btn-sm">
            <i className="bi bi-bar-chart"></i> Trip Summary
          </Link>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner fullPage text="Loading travel map..." />
      ) : trips.length === 0 ? (
        <EmptyState
          icon="bi-signpost-2"
          title="No Travel Trips Recorded"
          description="Create and complete a travel trip or run a live tracking session to record historical journeys."
          actionLabel="Plan New Trip"
          actionIcon="bi-plus-lg"
          onAction={() => navigate('/trips')}
        />
      ) : (
        <div className="row g-3">
          {/* Left Controls & Summary Column */}
          <div className="col-12 col-lg-4">
            {/* Trip Selector Card */}
            <div className="rt-card p-3 mb-3 border">
              <label className="form-label small fw-bold text-dark mb-1">Select Journey / Trip</label>
              <select
                className="form-select form-select-sm mb-2"
                value={selectedTrip?.id || ''}
                onChange={(e) => {
                  const t = trips.find((item) => item.id === e.target.value);
                  if (t) setSelectedTrip(t);
                }}
              >
                {filteredTrips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tripName || t.title} ({t.status?.toUpperCase()})
                  </option>
                ))}
              </select>

              {/* Date Filter */}
              <div className="input-group input-group-sm mb-2">
                <span className="input-group-text bg-light text-muted">
                  <i className="bi bi-calendar3"></i>
                </span>
                <input
                  type="date"
                  className="form-control"
                  placeholder="Filter by date"
                  value={tripDateFilter}
                  onChange={(e) => setTripDateFilter(e.target.value)}
                />
                {tripDateFilter && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setTripDateFilter('')}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Mode Switcher Card (Features 4 & 5) */}
            <div className="rt-card p-3 mb-3 border bg-white shadow-sm">
              <label className="form-label small fw-bold text-dark mb-2 d-flex justify-content-between align-items-center">
                <span>Map Display Mode</span>
                <span className={`badge ${routeMode === 'historical' ? 'bg-success' : 'bg-primary'}`}>
                  {routeMode === 'historical' ? 'Mode A Active' : 'Mode B Active'}
                </span>
              </label>

              <div className="btn-group w-100 mb-2">
                <button
                  type="button"
                  className={`btn btn-sm ${routeMode === 'historical' ? 'btn-success fw-bold' : 'btn-outline-secondary'}`}
                  onClick={() => setRouteMode('historical')}
                >
                  <i className="bi bi-broadcast-pin me-1"></i> Mode A: Historical GPS
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${routeMode === 'planned' ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`}
                  onClick={() => setRouteMode('planned')}
                >
                  <i className="bi bi-sign-turn-right me-1"></i> Mode B: Planned Road
                </button>
              </div>

              <div className="small text-muted p-2 rounded bg-light border">
                {routeMode === 'historical' ? (
                  <div>
                    <strong className="text-success d-block mb-1">
                      <i className="bi bi-shield-check me-1"></i> Mode A: Actual Recorded GPS Path
                    </strong>
                    Displays actual physical coordinates recorded during live tracking. Preserves true breadcrumbs without synthetic routing.
                  </div>
                ) : (
                  <div>
                    <strong className="text-primary d-block mb-1">
                      <i className="bi bi-compass me-1"></i> Mode B: Turn-by-Turn Road Route (OSRM)
                    </strong>
                    Calculates authentic road network geometry through stops. Displays road segments, real distance, and estimated travel times.
                  </div>
                )}
              </div>
            </div>

            {/* Selected Trip Summary Card (Feature 3) */}
            {selectedTrip && (
              <div className="rt-card p-3 border">
                <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                  <h6 className="fw-bold text-dark mb-0">{selectedTrip.tripName || selectedTrip.title}</h6>
                  <span className={`badge ${selectedTrip.status === 'completed' ? 'bg-success' : selectedTrip.status === 'active' ? 'bg-warning text-dark' : 'bg-secondary'} text-uppercase`}>
                    {selectedTrip.status}
                  </span>
                </div>

                <div className="row g-2 small mb-3">
                  <div className="col-6">
                    <span className="text-muted d-block">Start Location:</span>
                    <strong className="text-dark text-truncate d-block">
                      <i className="bi bi-geo-alt-fill text-dark me-1"></i>
                      {selectedTrip.startLocation || 'Base'}
                    </strong>
                  </div>
                  <div className="col-6">
                    <span className="text-muted d-block">End Location:</span>
                    <strong className="text-dark text-truncate d-block">
                      <i className="bi bi-flag-fill text-danger me-1"></i>
                      {selectedTrip.endLocation || 'Indiranagar'}
                    </strong>
                  </div>
                  <div className="col-6 mt-2">
                    <span className="text-muted d-block">Total Distance:</span>
                    <strong className="text-dark">{selectedTrip.totalDistance || '0 km'}</strong>
                  </div>
                  <div className="col-6 mt-2">
                    <span className="text-muted d-block">Duration:</span>
                    <strong className="text-dark">{selectedTrip.totalDuration || '0 mins'}</strong>
                  </div>
                  <div className="col-6 mt-2">
                    <span className="text-muted d-block">Recorded GPS Points:</span>
                    <strong className={historicalGpsPoints.length > 0 ? 'text-success' : 'text-muted'}>
                      {historicalGpsPoints.length} points
                    </strong>
                  </div>
                  <div className="col-6 mt-2">
                    <span className="text-muted d-block">Visited Destinations:</span>
                    <strong className="text-primary">
                      {tripVisits.length} visited
                    </strong>
                  </div>
                </div>

                {/* Mode B: Planned Route Segment Details (Feature 4) */}
                {routeMode === 'planned' && plannedRouteData?.legs && (
                  <div className="border-top pt-2 mt-2">
                    <div className="fw-bold small text-dark mb-2">Road Segments (Turn-by-Turn):</div>
                    <div className="list-group list-group-flush small" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      {plannedRouteData.legs.map((leg, idx) => (
                        <div key={idx} className="list-group-item px-1 py-1 d-flex justify-content-between align-items-center">
                          <div className="text-truncate" style={{ maxWidth: '170px' }}>
                            <span className="fw-semibold text-dark">Leg {idx + 1}:</span> {leg.toName}
                          </div>
                          <span className="badge bg-light text-secondary border font-monospace">
                            {leg.distanceKm} • {leg.durationMinutes}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Map Display Column */}
          <div className="col-12 col-lg-8">
            <div className="rt-card p-0 border overflow-hidden shadow-sm position-relative">
              {/* Map Canvas */}
              <div
                ref={mapContainerRef}
                style={{ height: '620px', width: '100%', zIndex: 1 }}
              />

              {/* Mode Banner Indicator Over Map */}
              <div
                className="position-absolute top-0 start-0 m-3 p-2 px-3 rounded shadow-sm bg-white border"
                style={{ zIndex: 1000, maxWidth: '420px' }}
              >
                <div className="d-flex align-items-center gap-2">
                  <span className={`badge ${routeMode === 'historical' ? 'bg-success' : 'bg-primary'} px-2 py-1`}>
                    {routeMode === 'historical' ? 'Mode A' : 'Mode B'}
                  </span>
                  <strong className="small text-dark">
                    {routeMode === 'historical'
                      ? 'Actual Recorded GPS Route'
                      : 'Planned Road Route (OSRM Real Geometry)'}
                  </strong>
                </div>

                {/* Historical Route Unavailable Warning (Feature 5 Requirement) */}
                {routeMode === 'historical' && historicalGpsPoints.length < 2 && (
                  <div className="alert alert-warning p-2 mt-2 mb-0 small border-warning">
                    <i className="bi bi-exclamation-triangle-fill me-1 text-warning"></i>
                    <strong>Historical GPS route data unavailable.</strong> The original recorded path cannot be reconstructed exactly without recorded breadcrumbs. Switch to <strong>Mode B</strong> to view the road-based route.
                  </div>
                )}

                {/* Planned Route Loading State (Feature 4 Requirement) */}
                {routeMode === 'planned' && plannedRouteLoading && (
                  <div className="d-flex align-items-center gap-2 mt-2 small text-primary">
                    <span className="spinner-border spinner-border-sm"></span>
                    Calculating real road geometry via OSRM...
                  </div>
                )}

                {/* Planned Route Error State (Feature 4 Requirement) */}
                {routeMode === 'planned' && plannedRouteError && (
                  <div className="alert alert-danger p-2 mt-2 mb-0 small">
                    <i className="bi bi-x-octagon-fill me-1"></i>
                    {plannedRouteError}
                  </div>
                )}
              </div>

              {/* Map Legend Floating on Bottom Left */}
              <div
                className="position-absolute bottom-0 start-0 m-3 p-2 px-3 rounded shadow-sm bg-white border small"
                style={{ zIndex: 1000 }}
              >
                <div className="fw-bold mb-1" style={{ fontSize: '0.75rem' }}>Map Legend:</div>
                <div className="d-flex align-items-center gap-3 flex-wrap" style={{ fontSize: '0.72rem' }}>
                  <div className="d-flex align-items-center gap-1">
                    <span style={{ display: 'inline-block', width: '12px', height: '4px', backgroundColor: '#7c3aed' }}></span>
                    <span>Actual GPS (Purple)</span>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <span style={{ display: 'inline-block', width: '12px', height: '4px', backgroundColor: '#0284c7' }}></span>
                    <span>Planned Road (Blue)</span>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <span className="badge rounded-circle p-1" style={{ width: '12px', height: '12px', backgroundColor: '#10b981' }}></span>
                    <span>Visited (Green)</span>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <span className="badge rounded-circle p-1" style={{ width: '12px', height: '12px', backgroundColor: '#ea580c' }}></span>
                    <span>Pending (Orange)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TravelHistoryMapPage;
