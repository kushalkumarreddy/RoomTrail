import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { tripService, propertyService, visitService } from '../../services';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import { formatDate, calculateDistanceMeters } from '../../utils/formatters';

// 10 Distinct, accessible colors for differentiating historical trips
const TRIP_PALETTE = [
  { stroke: '#7c3aed', name: 'Purple', bg: '#f3e8ff', border: '#c084fc' },
  { stroke: '#2563eb', name: 'Blue', bg: '#dbeafe', border: '#93c5fd' },
  { stroke: '#059669', name: 'Green', bg: '#d1fae5', border: '#6ee7b7' },
  { stroke: '#d97706', name: 'Amber', bg: '#fef3c7', border: '#fcd34d' },
  { stroke: '#dc2626', name: 'Red', bg: '#fee2e2', border: '#fca5a5' },
  { stroke: '#0891b2', name: 'Cyan', bg: '#cffafe', border: '#67e8f9' },
  { stroke: '#db2777', name: 'Pink', bg: '#fce7f3', border: '#f472b6' },
  { stroke: '#4f46e5', name: 'Indigo', bg: '#e0e7ff', border: '#a5b4fc' },
  { stroke: '#16a34a', name: 'Forest', bg: '#dcfce7', border: '#86efac' },
  { stroke: '#ea580c', name: 'Orange', bg: '#ffedd5', border: '#fdba74' },
];

const FullTravelMap = ({ initialTripId = 'all', onBackToList = null }) => {
  const [loading, setLoading] = useState(true);
  const [historyTrips, setHistoryTrips] = useState([]);
  const [properties, setProperties] = useState([]);
  const [visits, setVisits] = useState([]);

  // Filters State
  const [selectedTripFilter, setSelectedTripFilter] = useState(initialTripId || 'all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Selected Trip Info Card (when a route is clicked)
  const [activeTripDetails, setActiveTripDetails] = useState(null);

  // Map Refs
  const mapContainerRef = useRef(null);
  const leafletMapInstance = useRef(null);
  const routesLayerGroupRef = useRef(null);
  const markersLayerGroupRef = useRef(null);

  // 1. Load Data from Backend in a single grouped API call
  const loadHistoryData = useCallback(async () => {
    setLoading(true);
    try {
      const [routesData, propsData, visitsData] = await Promise.all([
        tripService.getHistoryRoutes().catch(() => []),
        propertyService.getAll().catch(() => []),
        visitService.getAll().catch(() => []),
      ]);

      setHistoryTrips(routesData || []);
      setProperties(propsData || []);
      setVisits(visitsData || []);

      if (initialTripId && initialTripId !== 'all') {
        const matched = routesData.find((t) => String(t.tripId) === String(initialTripId));
        if (matched) {
          setActiveTripDetails(matched);
        }
      }
    } catch (err) {
      console.error('Failed to load full travel map routes', err);
    } finally {
      setLoading(false);
    }
  }, [initialTripId]);

  useEffect(() => {
    loadHistoryData();
  }, [loadHistoryData]);

  // Assign distinct colors deterministically to trips
  const tripsWithColors = useMemo(() => {
    return historyTrips.map((trip, idx) => {
      const color = TRIP_PALETTE[idx % TRIP_PALETTE.length];
      return {
        ...trip,
        color,
        index: idx + 1,
      };
    });
  }, [historyTrips]);

  // Apply User Filters: Full History (all) vs Individual Trip + Date Range
  const filteredTrips = useMemo(() => {
    return tripsWithColors.filter((trip) => {
      // 1. Trip filter
      if (selectedTripFilter !== 'all' && String(trip.tripId) !== String(selectedTripFilter)) {
        return false;
      }

      // 2. Date range filter
      const tripDateStr = (trip.travelDate || trip.startTime || '').substring(0, 10);
      if (startDateFilter && tripDateStr && tripDateStr < startDateFilter) {
        return false;
      }
      if (endDateFilter && tripDateStr && tripDateStr > endDateFilter) {
        return false;
      }

      return true;
    });
  }, [tripsWithColors, selectedTripFilter, startDateFilter, endDateFilter]);

  // Helper: Format trip time
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

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (loading || !mapContainerRef.current) return;

    if (!leafletMapInstance.current) {
      // Default center: India / Hyderabad / Bengaluru
      const map = L.map(mapContainerRef.current, {
        center: [17.4938, 78.3968],
        zoom: 12,
        zoomControl: true,
      });

      // Standard Default OpenStreetMap Street Map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      routesLayerGroupRef.current = L.layerGroup().addTo(map);
      markersLayerGroupRef.current = L.layerGroup().addTo(map);
      leafletMapInstance.current = map;
    }

    const timer = setTimeout(() => {
      if (leafletMapInstance.current) {
        leafletMapInstance.current.invalidateSize();
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [loading]);

  // 3. Render Routes and Locations on Map whenever filtered trips change
  const renderAllRoutesOnMap = useCallback(() => {
    if (!leafletMapInstance.current || !routesLayerGroupRef.current || !markersLayerGroupRef.current) {
      return;
    }

    const map = leafletMapInstance.current;
    const routesGroup = routesLayerGroupRef.current;
    const markersGroup = markersLayerGroupRef.current;

    routesGroup.clearLayers();
    markersGroup.clearLayers();

    const allBounds = [];
    const displayedTripIds = new Set(filteredTrips.map((t) => String(t.tripId)));

    // A. Plot each trip's actual GPS recorded path
    filteredTrips.forEach((trip) => {
      const color = trip.color;
      const pts = trip.routePoints || [];

      // Valid coordinates array sorted chronologically by sequence number, then timestamp
      const sortedPts = [...pts]
        .filter((pt) => pt && (pt.latitude || pt.lat) && (pt.longitude || pt.lng))
        .sort((a, b) => {
          const seqA = a.sequenceNumber != null ? a.sequenceNumber : 0;
          const seqB = b.sequenceNumber != null ? b.sequenceNumber : 0;
          if (seqA !== seqB) return seqA - seqB;
          const timeA = new Date(a.recordedAt || a.timestamp || 0).getTime();
          const timeB = new Date(b.recordedAt || b.timestamp || 0).getTime();
          if (timeA !== timeB) return timeA - timeB;
          return String(a.id || '').localeCompare(String(b.id || ''));
        });

      const latLngs = sortedPts.map((pt) => [
        Number(pt.latitude || pt.lat),
        Number(pt.longitude || pt.lng),
      ]);

      const isTwoPointEndpointsOnly =
        latLngs.length === 2 &&
        calculateDistanceMeters(latLngs[0][0], latLngs[0][1], latLngs[1][0], latLngs[1][1]) > 200;

      if (latLngs.length > 0) {
        latLngs.forEach((coord) => allBounds.push(coord));

        // Draw Actual Travelled Path (Polyline) - skip fake straight lines for older endpoint-only trips
        if (latLngs.length >= 2 && !isTwoPointEndpointsOnly) {
          const polyline = L.polyline(latLngs, {
            color: color.stroke,
            weight: 5,
            opacity: 0.85,
            lineJoin: 'round',
            smoothFactor: 1,
          }).addTo(routesGroup);

          // Interaction: Hover highlight & Click to view details
          polyline.on('mouseover', () => {
            polyline.setStyle({ weight: 8, opacity: 1.0 });
          });
          polyline.on('mouseout', () => {
            polyline.setStyle({ weight: 5, opacity: 0.85 });
          });
          polyline.on('click', () => {
            setActiveTripDetails(trip);
          });

          // Polyline Popup
          polyline.bindPopup(`
            <div style="font-family: sans-serif; font-size: 12px; padding: 4px; min-width: 220px;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                <span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background-color: ${color.stroke}; border: 2px solid #ffffff; box-shadow: 0 1px 4px rgba(0,0,0,0.3);"></span>
                <strong style="color: #0b192c; font-size: 13px;">${trip.tripName || trip.title || `Trip #${trip.index}`}</strong>
              </div>
              <div style="color: #64748b; font-size: 11px; margin-bottom: 6px;">
                <i class="bi bi-calendar-event me-1"></i> ${formatDate(trip.travelDate)}
              </div>
              <div style="border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 11px; color: #334155; line-height: 1.5;">
                <div><strong>From:</strong> ${trip.startLocation || 'Start Location'}</div>
                <div><strong>To:</strong> ${trip.endLocation || 'End Location'}</div>
                <div><strong>Distance:</strong> ${trip.totalDistance || 'N/A'}</div>
                <div><strong>Duration:</strong> ${trip.totalDuration || 'N/A'}</div>
                <div><strong>Saved Locations:</strong> ${trip.savedLocationsCount || 0} rooms</div>
                <div><strong>GPS Points:</strong> ${pts.length} coordinates</div>
              </div>
            </div>
          `);
        }

        // Starting Point Marker (Color themed pin with green flag)
        const startCoord = latLngs[0];
        const startIcon = L.divIcon({
          className: `custom-trip-start-${trip.tripId}`,
          html: `
            <div style="background-color: ${color.stroke}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.35); color: #ffffff;">
              <i class="bi bi-geo-alt-fill" style="font-size: 15px;"></i>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const startMarker = L.marker(startCoord, { icon: startIcon, zIndexOffset: 900 }).addTo(markersGroup);
        startMarker.bindPopup(`
          <div style="font-size: 12px; font-family: sans-serif; padding: 2px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${color.stroke};"></span>
              <strong style="color: #0b192c;">${trip.tripName || trip.title}</strong>
            </div>
            <strong style="color: #10b981; font-size: 12px;"><i class="bi bi-flag-fill me-1"></i>Starting Point</strong><br/>
            <span style="color: #334155;">${trip.startLocation || 'Journey Start'}</span><br/>
            <span style="color: #64748b; font-size: 11px;">Time: ${formatTripTime(trip.startTime)}</span><br/>
            <span class="text-muted" style="font-size: 10px;">${startCoord[0].toFixed(5)}°, ${startCoord[1].toFixed(5)}°</span>
          </div>
        `);

        // Ending Point Marker (Color themed pin with red finish icon)
        if (latLngs.length > 1) {
          const endCoord = latLngs[latLngs.length - 1];
          const endIcon = L.divIcon({
            className: `custom-trip-end-${trip.tripId}`,
            html: `
              <div style="background-color: #ef4444; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.35); color: #ffffff;">
                <i class="bi bi-flag-fill" style="font-size: 14px;"></i>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          const endMarker = L.marker(endCoord, { icon: endIcon, zIndexOffset: 900 }).addTo(markersGroup);
          endMarker.bindPopup(`
            <div style="font-size: 12px; font-family: sans-serif; padding: 2px;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${color.stroke};"></span>
                <strong style="color: #0b192c;">${trip.tripName || trip.title}</strong>
              </div>
              <strong style="color: #ef4444; font-size: 12px;"><i class="bi bi-check-circle-fill me-1"></i>Ending Point</strong><br/>
              <span style="color: #334155;">${trip.endLocation || 'Journey Destination'}</span><br/>
              <span style="color: #64748b; font-size: 11px;">Time: ${formatTripTime(trip.endTime)}</span><br/>
              <span class="text-muted" style="font-size: 10px;">${endCoord[0].toFixed(5)}°, ${endCoord[1].toFixed(5)}°</span>
            </div>
          `);
        }
      }
    });

    // B. Plot Saved & Visited Room Locations
    properties.forEach((prop, idx) => {
      const lat = Number(prop.latitude || prop.lat);
      const lng = Number(prop.longitude || prop.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      // Check if property is related to displayed trips or show all in full mode
      const isRelatedToDisplayedTrip = visits.some(
        (v) => displayedTripIds.has(String(v.tripId)) && (String(v.propertyId) === String(prop.id) || String(v.destinationId) === String(prop.id))
      );

      // In individual trip filter mode, only show rooms linked to that trip
      if (selectedTripFilter !== 'all' && !isRelatedToDisplayedTrip) {
        return;
      }

      const isVisited = Boolean(prop.visited || prop.visitStatus === 'visited' || isRelatedToDisplayedTrip);
      const pinColor = isVisited ? '#10b981' : '#ea580c';

      allBounds.push([lat, lng]);

      const propIcon = L.divIcon({
        className: 'custom-property-pin',
        html: `
          <div style="background-color: ${pinColor}; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,0.35);">
            <i class="bi bi-door-open-fill" style="transform: rotate(45deg); color: #ffffff; font-size: 12px;"></i>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });

      const marker = L.marker([lat, lng], { icon: propIcon, zIndexOffset: 850 }).addTo(markersGroup);
      marker.bindPopup(`
        <div style="min-width: 200px; font-family: sans-serif; padding: 2px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
            <strong style="color: #0b192c; font-size: 13px;">${prop.name || 'Room Location'}</strong>
            <span style="font-size: 10px; padding: 1px 6px; border-radius: 4px; background: ${isVisited ? '#d1fae5' : '#ffedd5'}; color: ${isVisited ? '#065f46' : '#9a3412'}; font-weight: 600;">
              ${isVisited ? 'Visited' : 'Saved'}
            </span>
          </div>
          <div style="color: #64748b; font-size: 11px; margin-bottom: 4px;">${prop.address || prop.city || ''}</div>
          ${prop.rent ? `<div style="font-weight: 600; color: #0b192c; font-size: 12px; margin-bottom: 2px;">Rent: ${prop.rent}</div>` : ''}
          ${prop.contactNumber || prop.contactPhone ? `<div style="font-size: 11px; color: #475569; margin-bottom: 2px;"><i class="bi bi-telephone me-1"></i>${prop.contactNumber || prop.contactPhone}</div>` : ''}
          ${prop.notes ? `<div style="font-size: 11px; color: #64748b; font-style: italic; margin-top: 4px; border-top: 1px dashed #e2e8f0; padding-top: 3px;">"${prop.notes}"</div>` : ''}
          <div class="text-muted" style="font-size: 10px; margin-top: 4px;">${lat.toFixed(5)}°, ${lng.toFixed(5)}°</div>
        </div>
      `);
    });

    // C. Automatically adjust zoom and bounds to fit all available routes
    if (allBounds.length > 0) {
      try {
        map.fitBounds(allBounds, { padding: [40, 40], maxZoom: 15 });
      } catch (e) {
        console.warn('Could not fit map bounds', e);
      }
    }
  }, [filteredTrips, properties, visits, selectedTripFilter]);

  useEffect(() => {
    if (!loading && leafletMapInstance.current) {
      renderAllRoutesOnMap();
    }
  }, [loading, renderAllRoutesOnMap]);

  // Handle "Fit All Routes" Click
  const handleFitAllRoutes = () => {
    if (!leafletMapInstance.current) return;
    renderAllRoutesOnMap();
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedTripFilter('all');
    setStartDateFilter('');
    setEndDateFilter('');
    setActiveTripDetails(null);
  };

  if (loading) {
    return <LoadingSpinner fullPage text="Loading Full Travel Map & Historical GPS Routes..." />;
  }

  if (historyTrips.length === 0) {
    return (
      <EmptyState
        icon="bi-map"
        title="No Recorded Travel Routes Yet"
        description="Start live tracking when exploring the city. Once you complete trips, all recorded GPS paths will appear simultaneously on this Full Travel Map."
        actionLabel="Start Live Tracking"
        actionIcon="bi-broadcast"
        onAction={() => (window.location.href = '/live-tracking')}
      />
    );
  }

  return (
    <div className="full-travel-map-container" id="full-travel-map-wrapper">
      {/* 1. Header & Filters Toolbar */}
      <div className="bg-white p-3 rounded border shadow-sm mb-3" id="full-travel-map-filters-card">
        <div className="row g-2 align-items-center">
          {/* Trip Selector Filter */}
          <div className="col-12 col-md-4">
            <label className="form-label small fw-bold text-dark mb-1">
              <i className="bi bi-filter me-1 text-primary"></i> Trip View Filter:
            </label>
            <select
              className="form-select form-select-sm"
              value={selectedTripFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedTripFilter(val);
                if (val !== 'all') {
                  const t = tripsWithColors.find((item) => String(item.tripId) === String(val));
                  setActiveTripDetails(t || null);
                } else {
                  setActiveTripDetails(null);
                }
              }}
              id="full-travel-map-trip-filter"
            >
              <option value="all">Full History (All Recorded Trips)</option>
              {tripsWithColors.map((t) => (
                <option key={t.tripId} value={t.tripId}>
                  Trip #{t.index}: {t.tripName || t.title} ({formatDate(t.travelDate)})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range: From */}
          <div className="col-6 col-md-3">
            <label className="form-label small fw-bold text-dark mb-1">
              <i className="bi bi-calendar-event me-1 text-primary"></i> From Date:
            </label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              id="full-travel-map-start-date"
            />
          </div>

          {/* Date Range: To */}
          <div className="col-6 col-md-3">
            <label className="form-label small fw-bold text-dark mb-1">
              <i className="bi bi-calendar-check me-1 text-primary"></i> To Date:
            </label>
            <input
              type="date"
              className="form-control form-control-sm"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              id="full-travel-map-end-date"
            />
          </div>

          {/* Filter Reset / Fit Buttons */}
          <div className="col-12 col-md-2 d-flex gap-2 align-items-end pt-md-4">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary w-50"
              onClick={handleResetFilters}
              id="full-travel-map-reset-btn"
              title="Reset all filters to view all trips"
            >
              <i className="bi bi-arrow-counterclockwise me-1"></i> Reset
            </button>
            <button
              type="button"
              className="btn btn-sm btn-rt-primary w-50"
              onClick={handleFitAllRoutes}
              id="full-travel-map-fit-bounds-btn"
              title="Automatically fit zoom to all routes"
            >
              <i className="bi bi-arrows-fullscreen me-1"></i> Fit
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top small text-muted">
          <div>
            Showing <strong className="text-dark">{filteredTrips.length}</strong> of{' '}
            <strong className="text-dark">{tripsWithColors.length}</strong> trips simultaneously on default OpenStreetMap.
          </div>
          {onBackToList && (
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-decoration-none"
              onClick={onBackToList}
              id="full-travel-map-back-to-list-btn"
            >
              <i className="bi bi-list-ul me-1"></i> Back to Journeys Table
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Map View & Legend Row */}
      <div className="row g-3">
        {/* Interactive Map Column */}
        <div className={activeTripDetails ? 'col-12 col-lg-8' : 'col-12'}>
          <div className="position-relative bg-white border rounded shadow-sm overflow-hidden">
            <div
              ref={mapContainerRef}
              id="full-travel-leaflet-map"
              style={{
                height: '560px',
                width: '100%',
                borderRadius: '6px',
              }}
            />

            {/* Map Legend Overlay in bottom-left */}
            <div
              className="position-absolute bg-white p-2 rounded shadow-sm border"
              style={{
                bottom: '16px',
                left: '16px',
                zIndex: 1000,
                maxHeight: '180px',
                overflowY: 'auto',
                maxWidth: '280px',
                fontSize: '11px',
              }}
              id="full-travel-map-legend"
            >
              <strong className="d-block text-dark mb-1" style={{ fontSize: '11px' }}>
                <i className="bi bi-palette me-1"></i> Trip Routes Legend
              </strong>
              {filteredTrips.map((t) => (
                <div
                  key={t.tripId}
                  className="d-flex align-items-center gap-2 mb-1 p-1 rounded"
                  style={{
                    cursor: 'pointer',
                    background: activeTripDetails?.tripId === t.tripId ? t.color.bg : 'transparent',
                    border: activeTripDetails?.tripId === t.tripId ? `1px solid ${t.color.stroke}` : '1px solid transparent',
                  }}
                  onClick={() => setActiveTripDetails(t)}
                  title={`Click to view details of ${t.tripName || t.title}`}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: '14px',
                      height: '4px',
                      borderRadius: '2px',
                      backgroundColor: t.color.stroke,
                    }}
                  />
                  <span className="text-truncate fw-semibold" style={{ maxWidth: '170px' }}>
                    {t.tripName || t.title || `Trip #${t.index}`}
                  </span>
                  <span className="text-muted ms-auto" style={{ fontSize: '10px' }}>
                    {t.totalDistance || ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Active Trip Details Sidebar (Appears when a route is clicked) */}
        {activeTripDetails && (
          <div className="col-12 col-lg-4" id="full-travel-map-trip-sidebar">
            <div className="card shadow-sm border h-100">
              <div
                className="card-header d-flex justify-content-between align-items-center py-2"
                style={{
                  backgroundColor: activeTripDetails.color?.bg || '#f8fafc',
                  borderBottom: `2px solid ${activeTripDetails.color?.stroke || '#0b192c'}`,
                }}
              >
                <div className="d-flex align-items-center gap-2">
                  <span
                    style={{
                      display: 'inline-block',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: activeTripDetails.color?.stroke || '#0b192c',
                    }}
                  />
                  <strong className="text-dark fs-6 text-truncate" style={{ maxWidth: '200px' }}>
                    {activeTripDetails.tripName || activeTripDetails.title || 'Trip Details'}
                  </strong>
                </div>
                <button
                  type="button"
                  className="btn-close btn-sm"
                  aria-label="Close"
                  onClick={() => setActiveTripDetails(null)}
                />
              </div>

              <div className="card-body p-3">
                {/* Trip Quick Metrics */}
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <div className="p-2 rounded bg-light border text-center">
                      <div className="text-muted small" style={{ fontSize: '11px' }}>Date</div>
                      <strong className="text-dark small">{formatDate(activeTripDetails.travelDate)}</strong>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-2 rounded bg-light border text-center">
                      <div className="text-muted small" style={{ fontSize: '11px' }}>Status</div>
                      <span className="badge bg-success text-uppercase small" style={{ fontSize: '10px' }}>
                        {activeTripDetails.status || 'COMPLETED'}
                      </span>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-2 rounded bg-light border text-center">
                      <div className="text-muted small" style={{ fontSize: '11px' }}>Total Distance</div>
                      <strong className="text-dark small">{activeTripDetails.totalDistance || '1.5 km'}</strong>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-2 rounded bg-light border text-center">
                      <div className="text-muted small" style={{ fontSize: '11px' }}>Duration</div>
                      <strong className="text-dark small">{activeTripDetails.totalDuration || '35 mins'}</strong>
                    </div>
                  </div>
                </div>

                {/* Journey Details */}
                <div className="mb-3">
                  <label className="text-muted small fw-bold d-block mb-1">Route Waypoints</label>
                  <div className="p-2 rounded bg-light border small">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <i className="bi bi-geo-alt-fill text-success"></i>
                      <div>
                        <strong>Start:</strong> {activeTripDetails.startLocation || 'Journey Start'}
                        <span className="text-muted ms-1">({formatTripTime(activeTripDetails.startTime)})</span>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <i className="bi bi-flag-fill text-danger"></i>
                      <div>
                        <strong>Destination:</strong> {activeTripDetails.endLocation || 'Final Stop'}
                        <span className="text-muted ms-1">({formatTripTime(activeTripDetails.endTime)})</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* GPS Breadcrumbs Info */}
                <div className="mb-3">
                  <label className="text-muted small fw-bold d-block mb-1">GPS Recording Details</label>
                  <div className="p-2 rounded bg-light border small text-muted">
                    <div>
                      <i className="bi bi-broadcast text-primary me-1"></i> Recorded GPS Points:{' '}
                      <strong className="text-dark">{activeTripDetails.routePoints?.length || 0} points</strong>
                    </div>
                    <div>
                      <i className="bi bi-door-open text-primary me-1"></i> Saved / Visited Locations:{' '}
                      <strong className="text-dark">{activeTripDetails.savedLocationsCount || 0} rooms</strong>
                    </div>
                  </div>
                </div>

                {/* Focus Map on this Trip */}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary w-100"
                  onClick={() => {
                    setSelectedTripFilter(activeTripDetails.tripId);
                  }}
                  id="focus-trip-route-btn"
                >
                  <i className="bi bi-zoom-in me-1"></i> Focus Only on This Route
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FullTravelMap;
