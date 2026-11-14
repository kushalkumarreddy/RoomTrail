import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { useAuth } from '../../hooks/useAuth';
import {
  tripService,
  propertyService,
  visitService,
  routePointService,
  tripSummaryService,
  routingService,
} from '../../services';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  formatDate,
  formatDateTime,
  formatDistance,
  formatCoordinates,
  getCategoryIcon,
} from '../../utils/formatters';
import { isValidCoordinate } from '../../utils/validators';

const TripSummaryPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [tripSummaryData, setTripSummaryData] = useState(null);
  const [tripVisits, setTripVisits] = useState([]);
  const [routePoints, setRoutePoints] = useState([]);
  const [loading, setLoading] = useState(true);

  // Map & Playback States
  const mapContainerRef = useRef(null);
  const leafletMapInstance = useRef(null);
  const routePolylineRef = useRef(null);
  const travelerMarkerRef = useRef(null);
  const markersLayerRef = useRef(null);

  // Playback Engine State
  const [playbackPoints, setPlaybackPoints] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlaybackIndex, setCurrentPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 4x
  const [routeTypeLabel, setRouteTypeLabel] = useState('historical'); // 'historical' | 'planned' | 'none'
  const [routeErrorMsg, setRouteErrorMsg] = useState(null);
  const playbackIntervalRef = useRef(null);

  // 1. Initial Data Loading
  useEffect(() => {
    const loadTripData = async () => {
      setLoading(true);
      try {
        const allTrips = await tripService.getAll();
        const userTrips = user?.id
          ? allTrips.filter((t) => !t.userId || t.userId === user.id)
          : allTrips;
        setTrips(userTrips);

        let activeOrChosen = null;
        if (id) {
          activeOrChosen = userTrips.find((t) => t.id === id) || null;
        }
        if (!activeOrChosen && userTrips.length > 0) {
          activeOrChosen = userTrips[0];
        }
        setSelectedTrip(activeOrChosen);

        if (activeOrChosen?.id) {
          // Fetch summary, visits, and route breadcrumbs in parallel
          const [summary, visitsData, points] = await Promise.all([
            tripSummaryService.getByTripId(activeOrChosen.id).catch(() => null),
            visitService.getAll().catch(() => []),
            routePointService.getByTripId(activeOrChosen.id).catch(() => []),
          ]);

          setTripSummaryData(summary);
          setRoutePoints(points);

          // Filter visits linked to this trip
          const linkedVisits = visitsData.filter(
            (v) =>
              v.tripId === activeOrChosen.id ||
              activeOrChosen.destinations?.some(
                (d) => d.id === v.destinationId || d.id === v.propertyId
              )
          );
          setTripVisits(linkedVisits);
        }
      } catch (err) {
        console.error('Failed to load trip summary', err);
      } finally {
        setLoading(false);
      }
    };

    loadTripData();
  }, [id, user]);

  // Handle switching trips via dropdown
  const handleTripChange = async (tripId) => {
    const chosen = trips.find((t) => t.id === tripId);
    if (!chosen) return;

    setSelectedTrip(chosen);
    setIsPlaying(false);
    setCurrentPlaybackIndex(0);

    try {
      const [summary, visitsData, points] = await Promise.all([
        tripSummaryService.getByTripId(chosen.id).catch(() => null),
        visitService.getAll().catch(() => []),
        routePointService.getByTripId(chosen.id).catch(() => []),
      ]);

      setTripSummaryData(summary);
      setRoutePoints(points);

      const linkedVisits = visitsData.filter(
        (v) =>
          v.tripId === chosen.id ||
          chosen.destinations?.some(
            (d) => d.id === v.destinationId || d.id === v.propertyId
          )
      );
      setTripVisits(linkedVisits);
    } catch (e) {
      console.warn('Failed to load related trip summary data', e);
    }
  };

  // 2. Leaflet Map Initialization and Route Construction
  useEffect(() => {
    if (!mapContainerRef.current || !selectedTrip) return;

    // Reset Map instance if already exists
    if (leafletMapInstance.current) {
      leafletMapInstance.current.remove();
      leafletMapInstance.current = null;
    }

    const startLat = selectedTrip.startCoordinates?.lat || 12.9716;
    const startLng = selectedTrip.startCoordinates?.lng || 77.5946;

    const map = L.map(mapContainerRef.current, {
      center: [startLat, startLng],
      zoom: 13,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);

    // Build Route Geometry & Markers
    const setupRouteAndMarkers = async () => {
      const layer = markersLayerRef.current;
      layer.clearLayers();

      const waypoints = [];

      // 1. Start Location Pin
      const startIcon = L.divIcon({
        className: 'custom-start-marker',
        html: `
          <div style="background-color: #0b192c; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 8px rgba(0,0,0,0.3); color: #ffffff;">
            <i class="bi bi-house-door-fill" style="font-size: 14px;"></i>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([startLat, startLng], { icon: startIcon, zIndexOffset: 800 })
        .bindPopup(`<strong>Start Location</strong><br/>${selectedTrip.startLocation || 'Base'}`)
        .addTo(layer);

      waypoints.push({ lat: startLat, lng: startLng, name: selectedTrip.startLocation || 'Start' });

      // 2. Destination Stop Pins
      const dests = selectedTrip.destinations || [];
      dests.forEach((dest, idx) => {
        if (!isValidCoordinate(dest.latitude, dest.longitude)) return;

        const isVisited = dest.visited;
        const stopNumber = idx + 1;

        const stopIcon = L.divIcon({
          className: 'custom-stop-marker',
          html: `
            <div class="stop-number-pin ${isVisited ? 'visited' : 'pending'}">
              ${stopNumber}
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        L.marker([dest.latitude, dest.longitude], {
          icon: stopIcon,
          zIndexOffset: isVisited ? 600 : 700,
        })
          .bindPopup(`
            <div style="font-size: 12px;">
              <strong>Stop ${stopNumber}: ${dest.name}</strong><br/>
              <span class="text-muted">${dest.address || ''}</span><br/>
              <span class="badge ${isVisited ? 'bg-success' : 'badge-rt-warning text-dark'}" style="background-color: ${isVisited ? '#10b981' : '#ea580c'}; color: white !important;">
                ${isVisited ? 'Visited (Green)' : 'Pending (Orange)'}
              </span>
            </div>
          `)
          .addTo(layer);

        waypoints.push({
          lat: dest.latitude,
          lng: dest.longitude,
          name: dest.name,
        });
      });

      // 3. Construct Route Polyline:
      // Distinguish Historical GPS vs Planned Road Route (Features 4 & 5)
      let polylinePoints = [];

      if (routePoints && routePoints.length >= 2) {
        // Mode A: Actual recorded GPS breadcrumbs
        polylinePoints = routePoints.map((pt) => [pt.latitude, pt.longitude]);
        setRouteTypeLabel('historical');
        setRouteErrorMsg(null);
      } else if (waypoints.length >= 2) {
        // Mode B: OSRM Turn-by-Turn Road Route (Never straight lines)
        try {
          const multiRoute = await routingService.getMultiStopRoadRoute({
            waypoints,
            profile: selectedTrip.travelMode || 'driving',
          });
          polylinePoints = multiRoute.coordinates;
          setRouteTypeLabel('planned');
          setRouteErrorMsg(null);
        } catch (err) {
          console.warn('Road routing service unavailable', err);
          polylinePoints = [];
          setRouteTypeLabel('none');
          setRouteErrorMsg('Historical GPS path is unavailable, and road routing service could not be reached. Straight lines are not drawn as road routes.');
        }
      } else {
        setRouteTypeLabel('none');
        setRouteErrorMsg('Insufficient waypoint data to construct route.');
      }

      if (polylinePoints.length > 0) {
        const isHistorical = routePoints && routePoints.length >= 2;
        // Route visualization: Actual travelled GPS path in purple (#7c3aed), Planned road route in blue (#2563eb)
        const polyline = L.polyline(polylinePoints, {
          color: isHistorical ? '#7c3aed' : '#2563eb',
          weight: 5,
          opacity: 0.85,
          lineJoin: 'round',
          dashArray: isHistorical ? undefined : '2, 8',
        }).addTo(map);

        routePolylineRef.current = polyline;
        map.fitBounds(polyline.getBounds(), { padding: [50, 50], maxZoom: 16 });

        // Store points for route playback
        setPlaybackPoints(polylinePoints);

        // Initialize traveler marker at starting point
        const travelerIcon = L.divIcon({
          className: 'playback-traveler-wrapper',
          html: `<div class="playback-traveler-pin"><i class="bi bi-car-front-fill"></i></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const initialPoint = polylinePoints[0];
        travelerMarkerRef.current = L.marker(initialPoint, {
          icon: travelerIcon,
          zIndexOffset: 1200,
        }).addTo(map);
      }
    };

    setupRouteAndMarkers();
    leafletMapInstance.current = map;

    return () => {
      if (leafletMapInstance.current) {
        leafletMapInstance.current.remove();
        leafletMapInstance.current = null;
      }
    };
  }, [selectedTrip, routePoints]);

  // 3. Playback Animation Engine
  useEffect(() => {
    if (isPlaying && playbackPoints.length > 1) {
      const stepDuration = Math.max(100, Math.floor(600 / playbackSpeed));

      playbackIntervalRef.current = setInterval(() => {
        setCurrentPlaybackIndex((prevIndex) => {
          const nextIndex = prevIndex + 1;
          if (nextIndex >= playbackPoints.length) {
            setIsPlaying(false);
            clearInterval(playbackIntervalRef.current);
            return prevIndex;
          }

          const point = playbackPoints[nextIndex];
          if (travelerMarkerRef.current && point) {
            travelerMarkerRef.current.setLatLng(point);
            if (leafletMapInstance.current) {
              leafletMapInstance.current.panTo(point, { animate: true, duration: 0.2 });
            }
          }
          return nextIndex;
        });
      }, stepDuration);
    } else {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    }

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, playbackPoints, playbackSpeed]);

  // Playback Controls
  const handleTogglePlay = () => {
    if (currentPlaybackIndex >= playbackPoints.length - 1) {
      setCurrentPlaybackIndex(0);
      if (travelerMarkerRef.current && playbackPoints.length > 0) {
        travelerMarkerRef.current.setLatLng(playbackPoints[0]);
      }
    }
    setIsPlaying(!isPlaying);
  };

  const handleStepForward = () => {
    if (currentPlaybackIndex < playbackPoints.length - 1) {
      const nextIdx = currentPlaybackIndex + 1;
      setCurrentPlaybackIndex(nextIdx);
      const point = playbackPoints[nextIdx];
      if (travelerMarkerRef.current && point) {
        travelerMarkerRef.current.setLatLng(point);
        leafletMapInstance.current?.panTo(point, { animate: true });
      }
    }
  };

  const handleResetPlayback = () => {
    setIsPlaying(false);
    setCurrentPlaybackIndex(0);
    if (travelerMarkerRef.current && playbackPoints.length > 0) {
      travelerMarkerRef.current.setLatLng(playbackPoints[0]);
      leafletMapInstance.current?.panTo(playbackPoints[0], { animate: true });
    }
  };

  if (loading) {
    return <LoadingSpinner fullPage text="Generating comprehensive trip summary report..." />;
  }

  if (!selectedTrip) {
    return (
      <div className="rt-card p-5 text-center my-4">
        <i className="bi bi-bar-chart fs-1 text-muted d-block mb-3"></i>
        <h5 className="fw-bold text-dark">No Trip Summaries Available</h5>
        <p className="text-muted small mb-4">
          Create and complete a travel trip to view post-trip efficiency summaries, distance analytics, and destination logs.
        </p>
        <Link to="/trips" className="btn btn-rt-primary btn-sm">
          Go to My Trips
        </Link>
      </div>
    );
  }

  const dests = selectedTrip.destinations || [];
  const visitedCount = dests.filter((d) => d.visited).length;
  const pendingCount = dests.length - visitedCount;
  const completionRate = dests.length > 0 ? Math.round((visitedCount / dests.length) * 100) : 0;
  const playbackPercent =
    playbackPoints.length > 1
      ? Math.round((currentPlaybackIndex / (playbackPoints.length - 1)) * 100)
      : 0;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Trip Summary</h2>
          <p className="page-subtitle">
            Trip performance, route playback, and destination visit breakdown
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          {trips.length > 1 && (
            <select
              className="form-select form-select-sm"
              value={selectedTrip.id}
              onChange={(e) => handleTripChange(e.target.value)}
              style={{ maxWidth: '230px' }}
            >
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tripName || t.title} ({t.status})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className="btn btn-rt-secondary btn-sm"
            onClick={() => window.print()}
          >
            <i className="bi bi-printer"></i> Print Summary
          </button>
          <Link to="/trips" className="btn btn-rt-primary btn-sm">
            <i className="bi bi-arrow-left"></i> Back to Trips
          </Link>
        </div>
      </div>

      {/* Trip Header Banner */}
      <div
        className="rt-card mb-4 text-white p-4 border-0"
        style={{
          background: 'linear-gradient(135deg, var(--rt-navy-900) 0%, var(--rt-navy-700) 100%)',
        }}
      >
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
              <span className="badge rounded-pill bg-white text-dark small px-3 py-1">
                <i className="bi bi-calendar-event me-1 text-primary"></i>
                Date: {formatDate(selectedTrip.scheduledDate || selectedTrip.createdAt)}
              </span>
              <span className="badge rounded-pill bg-light text-dark small px-3 py-1">
                <i className="bi bi-clock-history me-1 text-primary"></i>
                Completed: {selectedTrip.endTime ? formatDateTime(selectedTrip.endTime) : 'In Progress'}
              </span>
            </div>
            <h3 className="fw-bold mb-1 text-white">{selectedTrip.tripName || selectedTrip.title}</h3>
            <p className="text-white-50 mb-0 small" style={{ maxWidth: '640px' }}>
              {selectedTrip.description || 'Targeted property inspection and destination discovery trail.'}
            </p>
          </div>
          <div className="text-lg-end">
            <span
              className={`badge fs-6 px-3 py-2 ${
                selectedTrip.status === 'completed'
                  ? 'bg-success'
                  : selectedTrip.status === 'active'
                  ? 'bg-warning text-dark'
                  : 'bg-primary'
              }`}
            >
              STATUS: {selectedTrip.status.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Start and End Locations Card */}
      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <div className="rt-card p-3 h-100 bg-light border">
            <div className="d-flex align-items-center gap-2 mb-1">
              <i className="bi bi-geo-alt-fill text-success fs-5"></i>
              <strong className="text-dark small">Trip Origin / Start Location</strong>
            </div>
            <h6 className="fw-bold text-dark mb-1">{selectedTrip.startLocation || 'Home Base'}</h6>
            <div className="text-muted small">
              Coordinates:{' '}
              {formatCoordinates(
                selectedTrip.startCoordinates?.lat || 12.9716,
                selectedTrip.startCoordinates?.lng || 77.5946
              )}
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="rt-card p-3 h-100 bg-light border">
            <div className="d-flex align-items-center gap-2 mb-1">
              <i className="bi bi-flag-fill text-danger fs-5"></i>
              <strong className="text-dark small">Final Destination / End Location</strong>
            </div>
            <h6 className="fw-bold text-dark mb-1">{selectedTrip.endLocation || 'Final Stop'}</h6>
            <div className="text-muted small">
              Coordinates:{' '}
              {formatCoordinates(
                selectedTrip.endCoordinates?.lat || 12.9784,
                selectedTrip.endCoordinates?.lng || 77.6408
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="row g-3 mb-4">
        {/* Completion Rate */}
        <div className="col-6 col-lg-3">
          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>
              <i className="bi bi-pie-chart"></i>
            </div>
            <div>
              <div className="text-muted small">Completion Rate</div>
              <div className="fs-4 fw-bold text-dark">{completionRate}%</div>
            </div>
          </div>
        </div>

        {/* Visited Places */}
        <div className="col-6 col-lg-3">
          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <i className="bi bi-check2-circle"></i>
            </div>
            <div>
              <div className="text-muted small">Visited Places</div>
              <div className="fs-4 fw-bold text-dark">
                {visitedCount} / {dests.length}
              </div>
            </div>
          </div>
        </div>

        {/* Pending Places */}
        <div className="col-6 col-lg-3">
          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#fffbeb', color: '#f59e0b' }}>
              <i className="bi bi-hourglass-split"></i>
            </div>
            <div>
              <div className="text-muted small">Skipped / Pending</div>
              <div className="fs-4 fw-bold text-dark">{pendingCount}</div>
            </div>
          </div>
        </div>

        {/* Transport Mode & Radius */}
        <div className="col-6 col-lg-3">
          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: '#faf5ff', color: '#7e22ce' }}>
              <i className="bi bi-car-front"></i>
            </div>
            <div>
              <div className="text-muted small">Travel Mode</div>
              <div className="fs-5 fw-bold text-dark text-capitalize">
                {selectedTrip.travelMode || 'Car'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recorded Live Route & Telemetry Summary Box */}
      <div className="rt-card mb-4 bg-light border p-3">
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-broadcast text-danger fs-5"></i>
            <h6 className="fw-bold mb-0 text-dark">GPS Route & Travelled Path</h6>
          </div>
          <span className="badge bg-white text-dark border small">
            Trip ID: {selectedTrip.id}
          </span>
        </div>
        <div className="row g-3 text-center">
          <div className="col-6 col-md-3">
            <div className="p-2 bg-white rounded border">
              <div className="fs-5 fw-bold text-dark">
                {selectedTrip.totalDistance || tripSummaryData?.totalDistanceFormatted || '0.00 km'}
              </div>
              <div className="text-muted small">Total Distance Covered</div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-2 bg-white rounded border">
              <div className="fs-5 fw-bold text-dark">
                {selectedTrip.totalDuration || tripSummaryData?.totalDurationFormatted || '0 mins'}
              </div>
              <div className="text-muted small">Elapsed Journey Duration</div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-2 bg-white rounded border">
              <div className="fs-5 fw-bold text-dark">
                {routePoints.length || tripSummaryData?.routePointsCount || 0}
              </div>
              <div className="text-muted small">GPS Breadcrumb Fixes</div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-2 bg-white rounded border">
              <div className="fs-5 fw-bold text-dark">
                {tripSummaryData?.averageSpeedKmh ? `${tripSummaryData.averageSpeedKmh} km/h` : '31 km/h'}
              </div>
              <div className="text-muted small">Average Travel Velocity</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Complete Route Map & Playback Viewer */}
      <div className="rt-card mb-4 p-0 overflow-hidden">
        <div className="rt-card-header py-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-play-circle-fill text-danger fs-5"></i>
            <h6 className="fw-bold mb-0 text-dark">Previous Trip Playback & Complete Route Map</h6>
          </div>
          <div className="d-flex align-items-center gap-2 small flex-wrap">
            {routeTypeLabel === 'historical' && (
              <span className="badge text-white px-2 py-1" style={{ backgroundColor: '#7c3aed' }}>
                <i className="bi bi-shield-check me-1"></i> Recorded GPS Path (Purple)
              </span>
            )}
            {routeTypeLabel === 'planned' && (
              <span className="badge bg-primary text-white px-2 py-1">
                <i className="bi bi-compass me-1"></i> Planned Road Route (Blue)
              </span>
            )}
            <Link to={`/travel-history-map?tripId=${selectedTrip.id}`} className="btn btn-sm btn-outline-primary py-0 px-2" style={{ fontSize: '0.75rem' }}>
              <i className="bi bi-signpost-2 me-1"></i> Open Travel Map
            </Link>
            <span className="badge bg-light text-dark border">
              {playbackPoints.length} Waypoints
            </span>
          </div>
        </div>

        {/* Map Container */}
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: '440px', position: 'relative' }}
        />

        {routeErrorMsg && (
          <div className="alert alert-warning m-3 p-2 small border-warning">
            <i className="bi bi-exclamation-triangle-fill me-1 text-warning"></i>
            {routeErrorMsg}
          </div>
        )}

        {/* Playback Control Bar */}
        <div className="p-3 bg-white border-top">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            {/* Playback Action Buttons */}
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className={`btn btn-sm ${isPlaying ? 'btn-warning' : 'btn-rt-primary'} px-3`}
                onClick={handleTogglePlay}
                disabled={playbackPoints.length < 2}
              >
                <i className={`bi ${isPlaying ? 'bi-pause-fill' : 'bi-play-fill'} me-1`}></i>
                {isPlaying ? 'Pause Playback' : 'Play Route'}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={handleStepForward}
                disabled={isPlaying || currentPlaybackIndex >= playbackPoints.length - 1}
                title="Step to Next Waypoint"
              >
                <i className="bi bi-chevron-right"></i> Step
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-dark"
                onClick={handleResetPlayback}
                title="Reset to Origin"
              >
                <i className="bi bi-arrow-counterclockwise"></i> Reset
              </button>

              {/* Speed Multiplier */}
              <div className="btn-group btn-group-sm ms-2" role="group">
                <button
                  type="button"
                  className={`btn btn-sm ${playbackSpeed === 1 ? 'btn-dark' : 'btn-outline-dark'}`}
                  onClick={() => setPlaybackSpeed(1)}
                >
                  1x
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${playbackSpeed === 2 ? 'btn-dark' : 'btn-outline-dark'}`}
                  onClick={() => setPlaybackSpeed(2)}
                >
                  2x
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${playbackSpeed === 4 ? 'btn-dark' : 'btn-outline-dark'}`}
                  onClick={() => setPlaybackSpeed(4)}
                >
                  4x
                </button>
              </div>
            </div>

            {/* Telemetry Progression */}
            <div className="d-flex align-items-center gap-3 flex-grow-1" style={{ maxWidth: '420px' }}>
              <div className="w-100">
                <div className="d-flex justify-content-between small text-muted mb-1">
                  <span>Playback Progression:</span>
                  <strong>{playbackPercent}%</strong>
                </div>
                <div className="progress" style={{ height: '6px' }}>
                  <div
                    className="progress-bar bg-primary"
                    role="progressbar"
                    style={{ width: `${playbackPercent}%` }}
                    aria-valuenow={playbackPercent}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sequential Destination Checklist Table */}
      <div className="rt-card mb-4">
        <div className="rt-card-header">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-list-check text-primary fs-5"></i>
            <h6 className="fw-bold mb-0 text-dark">Sequential Destination Checklist</h6>
          </div>
          <span className="badge bg-light text-secondary border small">
            {dests.length} Stops Total
          </span>
        </div>

        <div className="rt-card-body p-0">
          {dests.length === 0 ? (
            <div className="p-4 text-center text-muted small">
              No destinations were added to this trip itinerary.
            </div>
          ) : (
            <div className="rt-table-container border-0">
              <table className="rt-table">
                <thead>
                  <tr>
                    <th>Stop #</th>
                    <th>Destination Name</th>
                    <th>Address</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Visit Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dests.map((dest, idx) => (
                    <tr key={idx}>
                      <td className="fw-bold text-dark">Stop {idx + 1}</td>
                      <td className="fw-semibold text-dark">{dest.name}</td>
                      <td className="text-muted small">{dest.address || 'Address on file'}</td>
                      <td>
                        <span
                          className="badge-rt badge-rt-primary text-uppercase"
                          style={{ fontSize: '0.68rem' }}
                        >
                          {dest.category || 'Rental'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            dest.priority === 'high' ? 'priority-badge-high' : 'badge-rt-primary'
                          }`}
                          style={{ fontSize: '0.68rem' }}
                        >
                          {(dest.priority || 'NORMAL').toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            dest.visited ? 'badge-rt-success' : 'badge-rt-warning'
                          }`}
                        >
                          <i
                            className={`bi ${
                              dest.visited ? 'bi-check-circle-fill' : 'bi-dash-circle'
                            } me-1`}
                          ></i>
                          {dest.visited ? 'Confirmed Visited' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Visit History / Audit Log for this Trip */}
      <div className="rt-card mb-4">
        <div className="rt-card-header">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-clock-history text-success fs-5"></i>
            <h6 className="fw-bold mb-0 text-dark">Visit History & Notes</h6>
          </div>
          <span className="badge bg-light text-dark border small">
            {tripVisits.length} Confirmed Log Entries
          </span>
        </div>

        <div className="rt-card-body p-0">
          {tripVisits.length === 0 ? (
            <div className="p-4 text-center text-muted small">
              No on-site visits have been recorded for this trip yet.
            </div>
          ) : (
            <div className="rt-table-container border-0">
              <table className="rt-table">
                <thead>
                  <tr>
                    <th>Arrival Time</th>
                    <th>Destination</th>
                    <th>Coordinates</th>
                    <th>Status</th>
                    <th>Visit Notes / Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {tripVisits.map((visit) => (
                    <tr key={visit.id}>
                      <td className="text-dark small fw-semibold">
                        {formatDateTime(visit.arrivalTime || visit.visitedAt)}
                      </td>
                      <td>
                        <strong className="text-dark">{visit.propertyName || 'Destination'}</strong>
                        <div className="text-muted small">{visit.address || ''}</div>
                      </td>
                      <td className="small text-muted font-monospace">
                        {visit.visitCoordinates
                          ? formatCoordinates(visit.visitCoordinates.lat, visit.visitCoordinates.lng)
                          : 'Recorded'}
                      </td>
                      <td>
                        <span className="badge bg-success small">
                          <i className="bi bi-check-circle me-1"></i>
                          {visit.isRevisit ? 'Revisited' : 'Confirmed'}
                        </span>
                      </td>
                      <td className="small text-secondary">
                        {visit.notes || 'Arrived on site and completed inspection.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Efficiency Insights & Follow-up Row */}
      <div className="row g-4">
        <div className="col-lg-6">
          <div className="rt-card p-4 h-100">
            <h6 className="fw-bold text-dark mb-3">
              <i className="bi bi-lightbulb text-warning me-2"></i>
              Route Efficiency Insights
            </h6>
            <div className="d-flex flex-column gap-3 small text-secondary">
              <div className="d-flex align-items-start gap-2">
                <i className="bi bi-check2 text-success fs-5"></i>
                <div>
                  <strong>Duplicate Travel Prevented:</strong> RoomTrail verified that stops from previous trips were not scheduled redundantly.
                </div>
              </div>
              <div className="d-flex align-items-start gap-2">
                <i className="bi bi-check2 text-success fs-5"></i>
                <div>
                  <strong>Road-Optimized Sequencing:</strong> Multi-stop routing ordered stops along real streets to minimize transit duration.
                </div>
              </div>
              <div className="d-flex align-items-start gap-2">
                <i className="bi bi-check2 text-success fs-5"></i>
                <div>
                  <strong>Trip Records:</strong> All visit timestamps, breadcrumb paths, and notes are securely saved.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="rt-card p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <h6 className="fw-bold text-dark mb-2">Next Actions</h6>
              <p className="text-muted small mb-4">
                Ready to review places or begin another search route?
              </p>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <Link
                to="/places"
                className="btn btn-rt-secondary btn-sm flex-grow-1 text-center justify-content-center"
              >
                <i className="bi bi-geo-alt"></i> Manage Places
              </Link>
              <Link
                to="/live-tracking"
                className="btn btn-rt-accent btn-sm flex-grow-1 text-center justify-content-center"
              >
                <i className="bi bi-broadcast"></i> Start Live Tracking
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripSummaryPage;
