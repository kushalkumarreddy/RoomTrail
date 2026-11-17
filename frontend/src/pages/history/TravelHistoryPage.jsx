import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { tripService, tripSummaryService, propertyService, visitService, routePointService } from '../../services';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import FullTravelMap from '../../components/history/FullTravelMap';
import TripTimelineView from '../../components/history/TripTimelineView';
import ExportTravelHistoryModal from '../../components/history/ExportTravelHistoryModal';
import DeleteTripConfirmModal from '../../components/history/DeleteTripConfirmModal';
import { formatDate, formatDistance, formatDurationSeconds, getCategoryIcon, calculateDistanceMeters, hasSufficientGpsRoute, buildRouteSegments } from '../../utils/formatters';

const TravelHistoryPage = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = searchParams.get('mode');
  const initialView = searchParams.get('view');
  const initialTripId = searchParams.get('tripId');

  const [viewMode, setViewMode] = useState(
    initialView === 'timeline' && initialTripId ? 'timeline' : initialMode === 'map' ? 'map' : 'list'
  );
  const [timelineTripId, setTimelineTripId] = useState(
    initialView === 'timeline' && initialTripId ? initialTripId : null
  );

  // Phase 7: Export Travel History Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Phase 8: Trip Deletion State
  const [tripToDelete, setTripToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingTrip, setIsDeletingTrip] = useState(false);

  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [tripSummaries, setTripSummaries] = useState([]);
  const [properties, setProperties] = useState([]);
  const [visits, setVisits] = useState([]);

  // Active Journey for Route Modal
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [routePoints, setRoutePoints] = useState([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeEndpointsOnly, setRouteEndpointsOnly] = useState(false);

  // Map Ref for Route Modal
  const mapModalRef = useRef(null);
  const leafletModalInstance = useRef(null);

  // 1. Load Data from MySQL via Spring Boot APIs
  const loadData = async () => {
    setLoading(true);
    try {
      const [tripsData, summariesData, propsData, visitsData] = await Promise.all([
        tripService.getAll().catch(() => []),
        tripSummaryService.getAll().catch(() => []),
        propertyService.getAll().catch(() => []),
        visitService.getAll().catch(() => []),
      ]);

      const userTrips = user?.id
        ? tripsData.filter((t) => !t.userId || t.userId === user.id)
        : tripsData;
      const userSummaries = user?.id
        ? summariesData.filter((s) => !s.userId || s.userId === user.id)
        : summariesData;
      const userProps = user?.id
        ? propsData.filter((p) => !p.userId || p.userId === user.id)
        : propsData;
      const userVisits = user?.id
        ? visitsData.filter((v) => !v.userId || v.userId === user.id)
        : visitsData;

      setTrips(userTrips);
      setTripSummaries(userSummaries);
      setProperties(userProps);
      setVisits(userVisits);
    } catch (err) {
      console.error('Failed to load travel history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Synchronize viewMode and active timeline trip from URL search parameters
  useEffect(() => {
    const v = searchParams.get('view');
    const tid = searchParams.get('tripId');
    const m = searchParams.get('mode');
    if (v === 'timeline' && tid) {
      setViewMode('timeline');
      setTimelineTripId(tid);
    } else if (m === 'map') {
      setViewMode('map');
      setTimelineTripId(null);
    } else {
      setViewMode('list');
      setTimelineTripId(null);
    }
  }, [searchParams]);

  const handleViewTimeline = (journey) => {
    setTimelineTripId(journey.id);
    setViewMode('timeline');
    setSearchParams({ view: 'timeline', tripId: journey.id });
  };

  const handleBackFromTimeline = () => {
    setTimelineTripId(null);
    setViewMode('list');
    setSearchParams({});
  };

  // Helpers for formatting trip times
  const formatTripTime = (raw) => {
    if (!raw) return '--:--';
    if (raw.includes(':') && raw.length <= 8) return raw;
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return String(raw);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return String(raw);
    }
  };

  const formatTripEndTime = (raw, status) => {
    if (!raw) return status === 'active' ? 'In Progress' : '--:--';
    if (raw.includes(':') && raw.length <= 8) return raw;
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return String(raw);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return String(raw);
    }
  };

  // Combine trips with their corresponding summaries & saved locations
  const journeys = useMemo(() => {
    return trips.map((trip) => {
      const summary = tripSummaries.find(
        (s) => String(s.tripId) === String(trip.id) || String(s.id) === String(trip.id)
      );

      // Locations linked to this trip
      const linkedLocations = properties.filter((p) =>
        trip.destinationIds?.includes(p.id) ||
        trip.destinations?.some((d) => d.id === p.id) ||
        visits.some((v) => String(v.tripId) === String(trip.id) && (String(v.destinationId) === String(p.id) || String(v.propertyId) === String(p.id)))
      );

      const distanceDisplay = summary?.totalDistanceFormatted
        ? summary.totalDistanceFormatted
        : summary?.totalDistanceMeters
        ? formatDistance(summary.totalDistanceMeters)
        : trip.totalDistance || '1.5 km';

      const durationDisplay = summary?.totalDurationFormatted
        ? summary.totalDurationFormatted
        : summary?.totalDurationSeconds
        ? formatDurationSeconds(summary.totalDurationSeconds)
        : trip.totalDuration || trip.estimatedDuration || '35 mins';

      const travelDate = trip.scheduledDate || trip.startTime || summary?.createdAt || trip.createdAt;

      return {
        ...trip,
        summary,
        distanceDisplay,
        durationDisplay,
        travelDate,
        savedLocationsCount: linkedLocations.length || trip.destinations?.length || 0,
        locations: linkedLocations,
      };
    });
  }, [trips, tripSummaries, properties, visits]);

  // Handle "View Route" Action: loads actual GPS route points from MySQL
  const handleViewRoute = async (journey) => {
    setSelectedJourney(journey);
    setIsRouteModalOpen(true);
    setLoadingRoute(true);
    setRouteEndpointsOnly(false);

    try {
      const points = await routePointService.getByTripId(journey.id).catch(() => []);
      const sorted = (points || []).sort((a, b) => {
        const seqA = a.sequenceNumber != null ? a.sequenceNumber : 0;
        const seqB = b.sequenceNumber != null ? b.sequenceNumber : 0;
        if (seqA !== seqB) return seqA - seqB;
        const timeA = new Date(a.recordedAt || a.timestamp || 0).getTime();
        const timeB = new Date(b.recordedAt || b.timestamp || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return String(a.id || '').localeCompare(String(b.id || ''));
      });
      setRoutePoints(sorted);

      const hasRoute = hasSufficientGpsRoute(sorted);
      setRouteEndpointsOnly(!hasRoute);
    } catch (e) {
      console.warn('Could not load route points for journey', e);
      setRoutePoints([]);
      setRouteEndpointsOnly(true);
    } finally {
      setLoadingRoute(false);
    }
  };

  const handleDeleteTripPrompt = (trip) => {
    setTripToDelete(trip);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteTrip = async () => {
    if (!tripToDelete) return;
    setIsDeletingTrip(true);
    try {
      await tripService.delete(tripToDelete.id);
      showSuccess(`Trip "${tripToDelete.tripName || tripToDelete.title || 'Journey'}" and its location data have been deleted.`);
      setIsDeleteModalOpen(false);
      setTripToDelete(null);
      await loadData();
    } catch (err) {
      console.error('Failed to delete trip', err);
      showError(err.response?.data?.message || 'Failed to delete trip. Please try again.');
    } finally {
      setIsDeletingTrip(false);
    }
  };

  // Initialize Modal Map when opened
  useEffect(() => {
    if (!isRouteModalOpen || !selectedJourney) return;

    const timer = setTimeout(() => {
      if (!mapModalRef.current) return;

      if (leafletModalInstance.current) {
        leafletModalInstance.current.remove();
        leafletModalInstance.current = null;
      }

      // Default center: coordinates of route or Hyderabad / Bengaluru
      const defaultLat = selectedJourney.startLat || 17.4938;
      const defaultLng = selectedJourney.startLng || 78.3968;

      const map = L.map(mapModalRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 14,
        zoomControl: true,
      });

      // Standard Default OpenStreetMap street map tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      leafletModalInstance.current = map;

      const boundsGroup = [];

      // 1. Draw Actual Travelled Route (Purple Polyline #7c3aed) using original recorded GPS points
      const hasRoute = hasSufficientGpsRoute(routePoints);

      if (hasRoute) {
        const segments = buildRouteSegments(routePoints);

        if (segments.length > 0) {
          segments.forEach((seg) => seg.forEach((ll) => boundsGroup.push(ll)));

          // Draw purple polyline connecting the chronological GPS breadcrumb points along the actual travelled route
          L.polyline(segments, {
            color: '#7c3aed',
            weight: 5,
            opacity: 0.9,
            lineJoin: 'round',
            smoothFactor: 1,
          }).addTo(map);

          // A. Starting Point Marker (Green Start Pin)
          const startCoord = segments[0][0];
          const startIcon = L.divIcon({
            className: 'custom-start-marker',
            html: `
              <div style="background-color: #10b981; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.35); color: #ffffff;">
                <i class="bi bi-geo-alt-fill" style="font-size: 16px;"></i>
              </div>
            `,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          });

          const startMarker = L.marker(startCoord, { icon: startIcon, zIndexOffset: 950 }).addTo(map);
          startMarker.bindPopup(`
            <div style="font-size: 12px; font-family: sans-serif; padding: 2px;">
              <strong style="color: #10b981; font-size: 13px;"><i class="bi bi-flag-fill me-1"></i>Starting Point</strong><br/>
              <span style="color: #0b192c; font-weight: 600;">Time: ${formatTripTime(selectedJourney.startTime)}</span><br/>
              <span style="color: #64748b;">${selectedJourney.startLocation || 'Journey Start'}</span><br/>
              <span class="text-muted" style="font-size: 10px;">${startCoord[0].toFixed(5)}°, ${startCoord[1].toFixed(5)}°</span>
            </div>
          `);

          // B. Ending Point Marker (Red Finish Pin)
          const lastSeg = segments[segments.length - 1];
          const endCoord = lastSeg[lastSeg.length - 1];
          if (endCoord && (endCoord[0] !== startCoord[0] || endCoord[1] !== startCoord[1])) {
            const endIcon = L.divIcon({
              className: 'custom-end-marker',
              html: `
                <div style="background-color: #ef4444; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.35); color: #ffffff;">
                  <i class="bi bi-flag-fill" style="font-size: 15px;"></i>
                </div>
              `,
              iconSize: [34, 34],
              iconAnchor: [17, 17],
            });

            const endMarker = L.marker(endCoord, { icon: endIcon, zIndexOffset: 950 }).addTo(map);
            endMarker.bindPopup(`
              <div style="font-size: 12px; font-family: sans-serif; padding: 2px;">
                <strong style="color: #ef4444; font-size: 13px;"><i class="bi bi-check-circle-fill me-1"></i>Ending Point</strong><br/>
                <span style="color: #0b192c; font-weight: 600;">Time: ${formatTripEndTime(selectedJourney.endTime, selectedJourney.status)}</span><br/>
                <span style="color: #64748b;">${selectedJourney.endLocation || 'Journey Destination'}</span><br/>
                <span class="text-muted" style="font-size: 10px;">${endCoord[0].toFixed(5)}°, ${endCoord[1].toFixed(5)}°</span>
              </div>
            `);
          }
        }
      } else {
        // Insufficient GPS breadcrumb points (0 points, or only coarse start/end coordinates).
        // DO NOT draw a fake straight line between endpoints!
        // Render Green Start Pin and Red Finish Pin if coordinates exist.
        const startLat = selectedJourney.startLat || (routePoints && routePoints[0] ? (routePoints[0].latitude || routePoints[0].lat) : null);
        const startLng = selectedJourney.startLng || (routePoints && routePoints[0] ? (routePoints[0].longitude || routePoints[0].lng) : null);

        if (startLat && startLng) {
          const startPt = [Number(startLat), Number(startLng)];
          boundsGroup.push(startPt);
          const startIcon = L.divIcon({
            className: 'custom-start-marker',
            html: `
              <div style="background-color: #10b981; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.35); color: #ffffff;">
                <i class="bi bi-geo-alt-fill" style="font-size: 16px;"></i>
              </div>
            `,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          });
          const startMarker = L.marker(startPt, { icon: startIcon, zIndexOffset: 950 }).addTo(map);
          startMarker.bindPopup(`
            <div style="font-size: 12px; font-family: sans-serif; padding: 2px;">
              <strong style="color: #10b981; font-size: 13px;"><i class="bi bi-flag-fill me-1"></i>Starting Point</strong><br/>
              <span style="color: #0b192c; font-weight: 600;">Time: ${formatTripTime(selectedJourney.startTime)}</span><br/>
              <span style="color: #64748b;">${selectedJourney.startLocation || 'Journey Start'}</span><br/>
              <span class="text-muted" style="font-size: 10px;">${startPt[0].toFixed(5)}°, ${startPt[1].toFixed(5)}°</span>
            </div>
          `);
        }

        const endLat = selectedJourney.endLat || (routePoints && routePoints.length > 1 ? (routePoints[routePoints.length - 1].latitude || routePoints[routePoints.length - 1].lat) : null);
        const endLng = selectedJourney.endLng || (routePoints && routePoints.length > 1 ? (routePoints[routePoints.length - 1].longitude || routePoints[routePoints.length - 1].lng) : null);

        if (endLat && endLng) {
          const endPt = [Number(endLat), Number(endLng)];
          boundsGroup.push(endPt);
          const endIcon = L.divIcon({
            className: 'custom-end-marker',
            html: `
              <div style="background-color: #ef4444; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.35); color: #ffffff;">
                <i class="bi bi-flag-fill" style="font-size: 15px;"></i>
              </div>
            `,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          });
          const endMarker = L.marker(endPt, { icon: endIcon, zIndexOffset: 950 }).addTo(map);
          endMarker.bindPopup(`
            <div style="font-size: 12px; font-family: sans-serif; padding: 2px;">
              <strong style="color: #ef4444; font-size: 13px;"><i class="bi bi-check-circle-fill me-1"></i>Ending Point</strong><br/>
              <span style="color: #0b192c; font-weight: 600;">Time: ${formatTripEndTime(selectedJourney.endTime, selectedJourney.status)}</span><br/>
              <span style="color: #64748b;">${selectedJourney.endLocation || 'Journey Destination'}</span><br/>
              <span class="text-muted" style="font-size: 10px;">${endPt[0].toFixed(5)}°, ${endPt[1].toFixed(5)}°</span>
            </div>
          `);
        }
      }

      // 2. Plot Automatically Saved Locations & Visited Rooms with Relevant Visit Times
      const locs = selectedJourney.locations?.length > 0
        ? selectedJourney.locations
        : selectedJourney.destinations || [];

      locs.forEach((loc, idx) => {
        const lat = Number(loc.latitude || loc.lat);
        const lng = Number(loc.longitude || loc.lng);
        if (isNaN(lat) || isNaN(lng)) return;

        // Relevant Visit Time from visits table or property
        const visit = visits.find(
          (v) =>
            String(v.tripId) === String(selectedJourney.id) &&
            (String(v.propertyId) === String(loc.id) || String(v.destinationId) === String(loc.id))
        );
        const visitTime = visit?.arrivalTime || visit?.visitedAt || loc.visitedAt || loc.lastVisitedAt || loc.createdAt;
        const formattedVisitTime = visitTime ? formatTripTime(visitTime) : 'Detected';

        const isVisited = Boolean(loc.visited || visit);
        const pinColor = isVisited ? '#10b981' : '#ea580c';

        const customIcon = L.divIcon({
          className: 'custom-leaflet-pin',
          html: `
            <div style="background-color: ${pinColor}; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,0.3);">
              <span style="transform: rotate(45deg); color: #ffffff; font-size: 12px; font-weight: bold;">${idx + 1}</span>
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
        });

        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        marker.bindPopup(`
          <div style="min-width: 180px; font-family: sans-serif; padding: 2px;">
            <strong style="color: #0b192c; font-size: 13px;">${loc.name}</strong><br/>
            <small style="color: #64748b;">${loc.address || ''}</small><br/>
            ${loc.rent ? `<span style="font-weight: 600; color: #0b192c; font-size: 12px;">Rent: ${loc.rent}</span><br/>` : ''}
            <div style="margin-top: 4px; font-size: 11px; color: #334155;">
              <i class="bi bi-clock-history me-1 text-primary"></i> Visit Time: <strong>${formattedVisitTime}</strong>
            </div>
            <span style="display: inline-block; margin-top: 4px; padding: 2px 7px; font-size: 10px; border-radius: 4px; background: ${isVisited ? '#d1fae5' : '#ffedd5'}; color: ${isVisited ? '#065f46' : '#9a3412'}; font-weight: 600;">
              ${isVisited ? 'Visited Room' : 'Saved Room'}
            </span>
          </div>
        `);
        boundsGroup.push([lat, lng]);
      });

      // Fit map view to bounds of route and saved locations
      if (boundsGroup.length > 0) {
        try {
          map.fitBounds(boundsGroup, { padding: [40, 40] });
        } catch (e) {
          map.setView([defaultLat, defaultLng], 14);
        }
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (leafletModalInstance.current) {
        leafletModalInstance.current.remove();
        leafletModalInstance.current = null;
      }
    };
  }, [isRouteModalOpen, selectedJourney, routePoints, visits]);

  if (loading) {
    return <LoadingSpinner fullPage text="Loading travel history..." />;
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Travel History</h2>
          <p className="page-subtitle">
            Previous journeys, recorded GPS routes, travel duration, distance covered, and saved rooms
          </p>
        </div>

        <div className="d-flex gap-2 align-items-center flex-wrap">
          {/* View Mode Toggle: Journeys List vs Full Travel Map vs Timeline */}
          <div className="btn-group btn-group-sm" role="group" aria-label="Travel History View Mode" id="travel-history-view-toggle">
            <button
              type="button"
              className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => {
                setViewMode('list');
                setTimelineTripId(null);
                setSearchParams({});
              }}
              id="history-view-list-toggle"
            >
              <i className="bi bi-list-ul me-1"></i> Journeys List
            </button>
            <button
              type="button"
              className={`btn ${viewMode === 'map' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => {
                setViewMode('map');
                setTimelineTripId(null);
                setSearchParams({ mode: 'map' });
              }}
              id="history-view-map-toggle"
            >
              <i className="bi bi-map-fill me-1"></i> Full Travel Map
            </button>
            {viewMode === 'timeline' && (
              <button
                type="button"
                className="btn btn-primary"
                id="history-view-timeline-active-toggle"
              >
                <i className="bi bi-clock-history me-1"></i> Timeline
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn btn-outline-success btn-sm d-flex align-items-center gap-1"
            onClick={() => setIsExportModalOpen(true)}
            id="history-export-btn"
            title="Export Travel History (CSV / PDF / Route Points)"
          >
            <i className="bi bi-download"></i> Export History
          </button>
          <Link to="/live-tracking" className="btn btn-rt-primary btn-sm" id="history-live-tracking-btn">
            <i className="bi bi-broadcast"></i> Live Tracking
          </Link>
          <Link to="/rooms" className="btn btn-rt-secondary btn-sm" id="history-saved-rooms-btn">
            <i className="bi bi-door-open"></i> Saved Rooms
          </Link>
        </div>
      </div>

      {/* Conditionally render Full Travel Map OR Trip Timeline OR Journeys List Table */}
      {viewMode === 'map' ? (
        <FullTravelMap
          onBackToList={() => {
            setViewMode('list');
            setSearchParams({});
          }}
        />
      ) : viewMode === 'timeline' && timelineTripId ? (
        <TripTimelineView
          tripId={timelineTripId}
          onBack={handleBackFromTimeline}
          onOpenMap={(journeyData) => {
            const matched = journeys.find((j) => String(j.id) === String(timelineTripId)) || journeyData;
            handleViewRoute(matched);
          }}
          journey={journeys.find((j) => String(j.id) === String(timelineTripId))}
        />
      ) : journeys.length === 0 ? (
        <EmptyState
          icon="bi-signpost-2"
          title="No Travel Journeys Yet"
          description="Start live tracking when you search for rooms. Completed journeys and travelled routes will be recorded here automatically."
          actionLabel="Start Live Tracking"
          actionIcon="bi-broadcast"
          onAction={() => (window.location.href = '/live-tracking')}
        />
      ) : (
        <div className="rt-table-container shadow-sm border rounded bg-white" id="travel-history-table-container">
          <table className="rt-table" id="travel-history-table">
            <thead>
              <tr>
                <th>Previous Journey</th>
                <th>Travel Date</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Total Distance</th>
                <th>Duration</th>
                <th>Saved Locations</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {journeys.map((j) => (
                <tr key={j.id} id={`trip-row-${j.id}`}>
                  <td>
                    <div className="fw-bold text-dark fs-6">
                      {j.tripName || j.title || 'Room Hunting Journey'}
                    </div>
                    <div className="text-muted small">
                      <i className="bi bi-geo-alt me-1 text-primary"></i>
                      {j.startLocation || 'Base'} &rarr; {j.endLocation || 'Search Area'}
                    </div>
                  </td>
                  <td>
                    <div className="text-dark small fw-semibold">
                      {formatDate(j.travelDate)}
                    </div>
                  </td>
                  <td>
                    <span className="badge bg-light text-dark border small">
                      <i className="bi bi-clock me-1 text-success"></i>
                      {formatTripTime(j.startTime)}
                    </span>
                  </td>
                  <td>
                    <span className="badge bg-light text-dark border small">
                      <i className="bi bi-check-circle me-1 text-secondary"></i>
                      {formatTripEndTime(j.endTime, j.status)}
                    </span>
                  </td>
                  <td>
                    <span className="fw-bold text-dark">
                      {j.distanceDisplay}
                    </span>
                  </td>
                  <td>
                    <span className="badge bg-light text-secondary border small">
                      {j.durationDisplay}
                    </span>
                  </td>
                  <td>
                    <span className="badge bg-primary-subtle text-primary border border-primary small px-2 py-1">
                      <i className="bi bi-door-open me-1"></i>
                      {j.savedLocationsCount} rooms
                    </span>
                  </td>
                  <td className="text-end">
                    <div className="d-flex justify-content-end gap-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary px-2"
                        onClick={() => handleViewTimeline(j)}
                        id={`travel-history-view-timeline-${j.id}`}
                        title="View Chronological Stop Timeline"
                      >
                        <i className="bi bi-clock-history me-1"></i> Timeline
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-rt-primary px-3"
                        onClick={() => handleViewRoute(j)}
                        id={`travel-history-view-route-${j.id}`}
                      >
                        <i className="bi bi-map me-1"></i> View Route
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger px-2"
                        onClick={() => handleDeleteTripPrompt(j)}
                        id={`travel-history-delete-btn-${j.id}`}
                        title="Delete Trip & Location Data"
                      >
                        <i className="bi bi-trash3"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Historical Route Map Modal */}
      <Modal
        isOpen={isRouteModalOpen}
        onClose={() => setIsRouteModalOpen(false)}
        title={selectedJourney ? `${selectedJourney.tripName || selectedJourney.title || 'Journey'} Route Map` : 'Travelled Route'}
        size="lg"
        footer={
          <div className="d-flex justify-content-between align-items-center w-100">
            <div className="small text-muted">
              Actual recorded GPS route drawn in <strong>purple</strong> &bull; Start: green &bull; Finish: red.
            </div>
            <div className="d-flex gap-2">
              {selectedJourney && (
                <Link
                  to={`/travel-history-map?tripId=${selectedJourney.id}`}
                  className="btn btn-sm btn-outline-primary"
                  id="open-full-history-map-btn"
                >
                  <i className="bi bi-arrows-fullscreen me-1"></i> Full Map View
                </Link>
              )}
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setIsRouteModalOpen(false)}
                id="close-route-modal-btn"
              >
                Close
              </button>
            </div>
          </div>
        }
      >
        {selectedJourney && (
          <div id="historical-route-modal-content">
            {/* Quick Metrics Bar */}
            <div className="row g-2 mb-3">
              <div className="col-3">
                <div className="p-2 rounded bg-light border text-center">
                  <div className="text-muted small" style={{ fontSize: '11px' }}>Date</div>
                  <strong className="text-dark small">{formatDate(selectedJourney.travelDate)}</strong>
                </div>
              </div>
              <div className="col-3">
                <div className="p-2 rounded bg-light border text-center">
                  <div className="text-muted small" style={{ fontSize: '11px' }}>Distance</div>
                  <strong className="text-dark small">{selectedJourney.distanceDisplay}</strong>
                </div>
              </div>
              <div className="col-3">
                <div className="p-2 rounded bg-light border text-center">
                  <div className="text-muted small" style={{ fontSize: '11px' }}>Duration</div>
                  <strong className="text-dark small">{selectedJourney.durationDisplay}</strong>
                </div>
              </div>
              <div className="col-3">
                <div className="p-2 rounded bg-light border text-center">
                  <div className="text-muted small" style={{ fontSize: '11px' }}>Saved Rooms</div>
                  <strong className="text-dark small">{selectedJourney.savedLocationsCount}</strong>
                </div>
              </div>
            </div>

            {routeEndpointsOnly && (
              <div className="alert alert-info py-2 px-3 mb-2 small d-flex align-items-center gap-2" id="endpoints-only-notice">
                <i className="bi bi-info-circle-fill text-primary fs-6"></i>
                <div>
                  <strong>Notice:</strong> Detailed GPS route was not recorded for this trip.
                </div>
              </div>
            )}

            {loadingRoute ? (
              <LoadingSpinner text="Loading original GPS route points from MySQL..." />
            ) : (
              <div
                ref={mapModalRef}
                id="historical-leaflet-route-map"
                style={{
                  height: '420px',
                  width: '100%',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  overflow: 'hidden',
                }}
              />
            )}
          </div>
        )}
      </Modal>

      {/* Phase 7: Export Travel History Modal */}
      <ExportTravelHistoryModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        trips={trips}
      />

      {/* Phase 8: Trip Deletion Confirmation Modal */}
      <DeleteTripConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setTripToDelete(null);
        }}
        onConfirm={handleConfirmDeleteTrip}
        trip={tripToDelete}
        isDeleting={isDeletingTrip}
      />
    </div>
  );
};

export default TravelHistoryPage;
