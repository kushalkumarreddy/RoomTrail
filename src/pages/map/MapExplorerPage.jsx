import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { propertyService, routingService } from '../../services';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import QuickAddPlaceModal from '../../components/places/QuickAddPlaceModal';
import { getCategoryIcon, formatDistance } from '../../utils/formatters';
import { isValidCoordinate } from '../../utils/validators';

const MapExplorerPage = () => {
  const { user } = useAuth();
  const { showSuccess, showError, showInfo, showWarning } = useNotification();
  const navigate = useNavigate();

  const mapContainerRef = useRef(null);
  const leafletMapInstance = useRef(null);
  const markersLayerGroup = useRef(null);
  const userMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const tempPinRef = useRef(null);

  const [searchParams] = useSearchParams();
  const targetPlaceId = searchParams.get('placeId') || searchParams.get('id');

  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // User location state
  const [userLocation, setUserLocation] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsDenied, setGpsDenied] = useState(false);

  // Active road route state
  const [activeRoute, setActiveRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(null);

  // Map-based coordinate picker mode
  const [pickerMode, setPickerMode] = useState(false);
  const [pickedCoordinates, setPickedCoordinates] = useState(null);

  // Quick Add Modal state
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddCoords, setQuickAddCoords] = useState(null);

  useEffect(() => {
    window.roomtrailOpenQuickAdd = (lat, lng) => {
      setQuickAddCoords({ lat, lng });
      setIsQuickAddOpen(true);
    };
    return () => {
      delete window.roomtrailOpenQuickAdd;
    };
  }, []);

  // Base fallback coordinates (Home base or Bengaluru center)
  const homeCoords = {
    lat: user?.homeCoordinates?.lat || 12.9716,
    lng: user?.homeCoordinates?.lng || 77.5946,
  };

  // Load places from backend
  const loadPlaces = async () => {
    setLoading(true);
    try {
      const data = await propertyService.getAll();
      const userPlaces = user?.id ? data.filter((p) => !p.userId || p.userId === user.id) : data;
      setPlaces(userPlaces);
    } catch (err) {
      showError('Failed to load destination markers for map.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlaces();
  }, [user]);

  // Auto-focus and highlight destination if opened with query parameter
  useEffect(() => {
    if (targetPlaceId && places.length > 0) {
      const match = places.find((p) => p.id === targetPlaceId || p.destinationId === targetPlaceId);
      if (match) {
        handleSelectPlace(match, true);
        showInfo(`Viewing ${match.name} on map`);
      }
    }
  }, [targetPlaceId, places]);

  // Request browser GPS position
  const detectUserGPS = useCallback(() => {
    if (!navigator.geolocation) {
      showWarning('Browser Geolocation is not supported. Using default city coordinates.');
      setUserLocation(homeCoords);
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
        };
        setUserLocation(coords);
        setGpsLoading(false);
        setGpsDenied(false);

        // Update user marker on map
        if (leafletMapInstance.current) {
          updateUserLocationMarker(coords);
        }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsDenied(true);
          showInfo('Location permission denied. Map is centered on your registered home coordinates.');
        } else {
          showWarning(`GPS unavailable (${err.message}). Using home base.`);
        }
        setUserLocation(homeCoords);
        if (leafletMapInstance.current) {
          updateUserLocationMarker(homeCoords);
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [homeCoords, showInfo, showWarning]);

  // Update or create User Location Marker
  const updateUserLocationMarker = (coords) => {
    if (!leafletMapInstance.current) return;
    const map = leafletMapInstance.current;

    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    const userIcon = L.divIcon({
      className: 'user-location-marker-wrapper',
      html: `<div class="user-location-pin" title="Your Location"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -12],
    });

    const marker = L.marker([coords.lat, coords.lng], {
      icon: userIcon,
      zIndexOffset: 1200,
    }).addTo(map);

    marker.bindPopup(`
      <div style="font-family: system-ui, sans-serif; font-size: 13px;">
        <strong style="color: #0b192c;">Your Current Location</strong><br/>
        <span style="color: #64748b; font-size: 11px;">${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°</span>
      </div>
    `);

    userMarkerRef.current = marker;
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!leafletMapInstance.current) {
      const map = L.map(mapContainerRef.current, {
        center: [homeCoords.lat, homeCoords.lng],
        zoom: 13,
        zoomControl: false,
      });

      // Zoom Controls (bottom-right)
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // OpenStreetMap Tiles with error handling
      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      tileLayer.on('tileerror', () => {
        console.warn('Map tile failed to load, retrying or checking connection');
      });

      markersLayerGroup.current = L.layerGroup().addTo(map);
      leafletMapInstance.current = map;

      // Click listener for map-based destination picking
      map.on('click', (e) => {
        const lat = Number(e.latlng.lat.toFixed(6));
        const lng = Number(e.latlng.lng.toFixed(6));

        // Place temporary marker
        if (tempPinRef.current) {
          map.removeLayer(tempPinRef.current);
        }

        const tempIcon = L.divIcon({
          className: 'temp-pin',
          html: `
            <div style="background-color: #7c3aed; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
              <span style="transform: rotate(45deg); color: #ffffff; font-size: 14px;"><i class="bi bi-geo"></i></span>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -30],
        });

        const tempMarker = L.marker([lat, lng], { icon: tempIcon }).addTo(map);
        tempMarker.bindPopup(`
          <div style="font-family: system-ui, sans-serif; font-size: 13px; text-align: center; min-width: 170px;">
            <strong style="color: #7c3aed;">Selected Coordinates</strong><br/>
            <span style="color: #475569; font-size: 11px;">${lat}°, ${lng}°</span><br/>
            <button
              onclick="window.roomtrailOpenQuickAdd && window.roomtrailOpenQuickAdd(${lat}, ${lng})"
              class="btn btn-sm btn-primary py-1 px-2 mt-2 w-100 d-flex align-items-center justify-content-center gap-1"
              style="font-size: 11px;"
            >
              <i class="bi bi-lightning-charge-fill"></i> Quick Save This Spot
            </button>
            <a href="/places/new?lat=${lat}&lng=${lng}" class="text-secondary small d-block mt-1" style="font-size: 10px;">
              Open Full Add Form
            </a>
          </div>
        `).openPopup();

        tempPinRef.current = tempMarker;
        setPickedCoordinates({ lat, lng });
      });

      detectUserGPS();
    }

    return () => {
      if (leafletMapInstance.current) {
        leafletMapInstance.current.remove();
        leafletMapInstance.current = null;
      }
    };
  }, []);

  // Calculate actual road route using OSRM
  const calculateRoadRoute = async (destination) => {
    if (!destination.latitude || !destination.longitude) {
      showError('This destination has no coordinates recorded.');
      return;
    }

    const startPoint = userLocation || homeCoords;
    setRouteLoading(true);
    setRouteError(null);

    // Clear previous polyline
    if (routePolylineRef.current && leafletMapInstance.current) {
      leafletMapInstance.current.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    try {
      showInfo(`Calculating actual road route to "${destination.name}" via OSRM...`);

      const routeResult = await routingService.getRoadRoute({
        startLat: startPoint.lat,
        startLng: startPoint.lng,
        endLat: destination.latitude,
        endLng: destination.longitude,
        profile: user?.travelMode || 'driving',
      });

      setActiveRoute({
        ...routeResult,
        destinationName: destination.name,
      });

      // Draw real road polyline along actual streets in blue (Permanent Design Standard)
      if (leafletMapInstance.current) {
        const polyline = L.polyline(routeResult.coordinates, {
          color: '#2563eb', // Planned road route: Blue
          weight: 5,
          opacity: 0.85,
          lineJoin: 'round',
        }).addTo(leafletMapInstance.current);

        routePolylineRef.current = polyline;

        // Fit map bounds to show route, user location, and destination
        leafletMapInstance.current.fitBounds(polyline.getBounds(), {
          padding: [60, 60],
          maxZoom: 16,
        });
      }

      showSuccess(`Road Route Found: ${routeResult.distanceKm} (${routeResult.durationMinutes})`);
    } catch (err) {
      setRouteError(err.message || 'Unable to calculate road route.');
      showError(err.message || 'Could not fetch road route from OSRM.');
    } finally {
      setRouteLoading(false);
    }
  };

  // Render markers whenever places, filter, or selected destination changes
  useEffect(() => {
    if (!leafletMapInstance.current || !markersLayerGroup.current) return;
    const layer = markersLayerGroup.current;
    layer.clearLayers();

    const filtered = places.filter((p) => {
      if (activeCategory === 'all') return true;
      if (activeCategory === 'visited') return p.visited;
      if (activeCategory === 'pending') return !p.visited;
      return p.category?.toLowerCase() === activeCategory.toLowerCase();
    });

    const validCoordPlaces = filtered.filter(
      (p) => isValidCoordinate(p.latitude, p.longitude)
    );

    validCoordPlaces.forEach((place) => {
      const isSelected = selectedPlace?.id === place.id;
      const isVisited = place.visited;

      // Permanent Map Design Standard:
      // - Visited: Green (#10b981)
      // - Pending: Orange (#ea580c)
      // - Selected: Highlighted Orange
      let pinColorClass = isVisited ? 'pin-green' : 'pin-orange';
      if (isSelected) {
        pinColorClass = 'pin-selected';
      }

      const customIcon = L.divIcon({
        className: 'custom-destination-marker',
        html: `
          <div class="custom-pin-base ${pinColorClass}">
            <span class="custom-pin-icon">
              <i class="bi ${isSelected ? 'bi-geo-alt-fill' : getCategoryIcon(place.category)}"></i>
            </span>
          </div>
        `,
        iconSize: isSelected ? [40, 40] : [34, 34],
        iconAnchor: isSelected ? [20, 40] : [17, 34],
        popupAnchor: [0, -32],
      });

      const marker = L.marker([place.latitude, place.longitude], {
        icon: customIcon,
        zIndexOffset: isSelected ? 1000 : (isVisited ? 100 : 200),
      });

      // Interactive popup
      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; min-width: 210px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${
              isSelected ? '#ea580c' : (isVisited ? '#059669' : '#ea580c')
            };">
              ${place.category || 'Rental'} • ${isVisited ? 'Visited' : 'Pending'}
            </span>
            <span style="font-size: 10px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 600;">
              ${place.priority || 'Normal'}
            </span>
          </div>
          <h6 style="font-weight: 700; color: #0b192c; margin: 0 0 4px 0; font-size: 14px;">
            ${place.name}
          </h6>
          <p style="font-size: 12px; color: #64748b; margin: 0 0 6px 0;">
            ${place.address || 'Address on record'}
          </p>
          <div style="font-size: 11px; color: #0284c7; margin-bottom: 8px;">
            <strong>Coordinates:</strong> ${Number(place.latitude).toFixed(4)}°, ${Number(place.longitude).toFixed(4)}°
          </div>
          ${
            place.rent || place.price
              ? `<div style="font-size: 13px; font-weight: 700; color: #0b192c; margin-bottom: 8px;">${place.rent || place.price}</div>`
              : ''
          }
          <div style="display: flex; gap: 4px;">
            <button id="btn-route-${place.id}" style="
              background-color: #ea580c; color: white; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer; flex: 1;
            ">
              <i class="bi bi-cursor"></i> Route Here
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      // Marker click handles selection and opens popup
      marker.on('click', () => {
        handleSelectPlace(place, false);
      });

      marker.on('popupopen', () => {
        const routeBtn = document.getElementById(`btn-route-${place.id}`);
        if (routeBtn) {
          routeBtn.onclick = () => {
            calculateRoadRoute(place);
          };
        }
      });

      layer.addLayer(marker);
    });
  }, [places, activeCategory, selectedPlace, userLocation]);

  // Handle destination selection
  const handleSelectPlace = (place, flyTo = true) => {
    setSelectedPlace(place);

    if (leafletMapInstance.current && place.latitude && place.longitude) {
      if (flyTo) {
        leafletMapInstance.current.flyTo([place.latitude, place.longitude], 15, {
          duration: 1,
        });
      }
    }
  };

  // Center on User location
  const handleCenterUser = () => {
    if (!leafletMapInstance.current) return;
    const target = userLocation || homeCoords;
    leafletMapInstance.current.flyTo([target.lat, target.lng], 15, { duration: 1 });
  };

  // Fit all destinations
  const handleFitAllPins = () => {
    if (!leafletMapInstance.current) return;
    const valid = places.filter((p) => isValidCoordinate(p.latitude, p.longitude));
    if (valid.length === 0) {
      handleCenterUser();
      return;
    }
    const bounds = valid.map((p) => [p.latitude, p.longitude]);
    if (userLocation) bounds.push([userLocation.lat, userLocation.lng]);
    leafletMapInstance.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
  };

  // Toggle visit status from map HUD
  const handleToggleVisitFromMap = async (place) => {
    try {
      const updated = await propertyService.update(place.id, {
        visited: !place.visited,
        visitStatus: !place.visited ? 'visited' : 'pending',
      });
      setPlaces((prev) =>
        prev.map((p) => (p.id === place.id ? { ...p, visited: updated.visited } : p))
      );
      if (selectedPlace?.id === place.id) {
        setSelectedPlace((prev) => ({ ...prev, visited: updated.visited }));
      }
      showSuccess(updated.visited ? `Marked "${place.name}" as Visited!` : `Marked "${place.name}" as Pending.`);
    } catch (err) {
      showError('Failed to update visit status.');
    }
  };

  return (
    <div className="d-flex flex-column" style={{ height: 'calc(100vh - var(--rt-header-height) - 4rem)' }}>
      {/* Top Header & Map Controls Toolbar */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h2 className="page-title mb-0">Map Explorer & Road Routing</h2>
          <span className="text-muted small">
            OpenStreetMap • Leaflet • OSRM Real Road Geometries
          </span>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2">
          {/* Category Filter Pills */}
          <div className="btn-group btn-group-sm" role="group">
            {[
              { id: 'all', label: 'All Destinations' },
              { id: 'pending', label: 'Pending (Orange)' },
              { id: 'visited', label: 'Visited (Green)' },
              { id: 'flat', label: 'Flats' },
              { id: 'pg', label: 'PGs' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`btn ${activeCategory === cat.id ? 'btn-rt-primary' : 'btn-rt-secondary'}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Map Destination Picker Toggle */}
          <button
            type="button"
            className={`btn btn-sm ${pickerMode ? 'btn-rt-accent' : 'btn-rt-secondary'}`}
            onClick={() => {
              setPickerMode((prev) => !prev);
              showInfo(
                pickerMode
                  ? 'Coordinate picker mode turned off.'
                  : 'Click anywhere on the map to drop a pin and capture coordinates!'
              );
            }}
            title="Click to drop a pin on the map"
          >
            <i className="bi bi-geo"></i> {pickerMode ? 'Picking Active' : 'Pick on Map'}
          </button>

          <button
            type="button"
            className="btn btn-rt-secondary btn-sm"
            onClick={() => setSidebarOpen((prev) => !prev)}
            title="Toggle Places Drawer"
          >
            <i className={`bi ${sidebarOpen ? 'bi-layout-sidebar-reverse' : 'bi-layout-sidebar-inset-reverse'}`}></i>
          </button>

          <button
            type="button"
            className="btn btn-rt-accent btn-sm d-flex align-items-center gap-1"
            onClick={() => {
              setQuickAddCoords(userLocation || homeCoords);
              setIsQuickAddOpen(true);
            }}
            id="map-quick-add-btn"
          >
            <i className="bi bi-lightning-charge-fill"></i> Quick Add Destination
          </button>

          <Link to="/places/new" className="btn btn-rt-primary btn-sm">
            <i className="bi bi-plus-lg"></i> Add Place
          </Link>
        </div>
      </div>

      {/* Permission / Status Notice if GPS denied */}
      {gpsDenied && (
        <div className="alert alert-warning py-2 px-3 small d-flex align-items-center justify-content-between mb-2">
          <div>
            <i className="bi bi-exclamation-triangle-fill me-2 text-warning"></i>
            Location permission was denied. The map is centered on your saved base coordinates ({homeCoords.lat.toFixed(4)}°, {homeCoords.lng.toFixed(4)}°).
          </div>
          <button type="button" className="btn btn-sm btn-outline-dark py-0" onClick={detectUserGPS}>
            Retry GPS
          </button>
        </div>
      )}

      {/* Main Map + Drawer Wrapper */}
      <div className="map-container-wrapper flex-grow-1 d-flex position-relative">
        {/* Floating Top Controls Overlay */}
        <div className="map-hud-overlay d-flex justify-content-between align-items-start">
          <div className="map-control-floating d-flex align-items-center gap-3">
            <div className="d-flex align-items-center gap-2">
              <span className="badge rounded-pill bg-light text-dark border small px-2 py-1">
                <i className="bi bi-geo-alt-fill me-1 text-primary"></i>
                {places.filter((p) => isValidCoordinate(p.latitude, p.longitude)).length} Pins
              </span>
              <span className="badge rounded-pill bg-warning-subtle text-warning-emphasis border border-warning-subtle small px-2 py-1">
                <span className="d-inline-block rounded-circle me-1" style={{ width: '8px', height: '8px', backgroundColor: '#ea580c' }}></span>
                Pending (Orange)
              </span>
              <span className="badge rounded-pill bg-success-subtle text-success border border-success small px-2 py-1">
                <span className="d-inline-block rounded-circle me-1" style={{ width: '8px', height: '8px', backgroundColor: '#10b981' }}></span>
                Visited (Green)
              </span>
              <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle small px-2 py-1">
                <span className="d-inline-block rounded-circle me-1" style={{ width: '8px', height: '8px', backgroundColor: '#2563eb' }}></span>
                Location / Route (Blue)
              </span>
            </div>
          </div>

          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-light border shadow-sm"
              onClick={handleCenterUser}
              title="Center on My Location"
              disabled={gpsLoading}
            >
              {gpsLoading ? (
                <span className="spinner-border spinner-border-sm"></span>
              ) : (
                <><i className="bi bi-cursor-fill text-primary"></i> My Location</>
              )}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-light border shadow-sm"
              onClick={handleFitAllPins}
              title="Show All Destinations"
            >
              <i className="bi bi-arrows-fullscreen"></i> Fit All
            </button>
          </div>
        </div>

        {/* Map Canvas */}
        <div
          ref={mapContainerRef}
          className="flex-grow-1"
          style={{ height: '100%', minHeight: '450px', zIndex: 1 }}
        />

        {/* Floating Road Route HUD (When road route is active) */}
        {activeRoute && (
          <div className="map-route-panel">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-warning text-dark fw-bold">OSRM Road Route</span>
                <span className="small text-muted text-capitalize">{activeRoute.profile}</span>
              </div>
              <button
                type="button"
                className="btn-close"
                style={{ fontSize: '0.75rem' }}
                onClick={() => {
                  if (routePolylineRef.current && leafletMapInstance.current) {
                    leafletMapInstance.current.removeLayer(routePolylineRef.current);
                    routePolylineRef.current = null;
                  }
                  setActiveRoute(null);
                }}
              />
            </div>

            <div className="fw-bold text-dark mb-1 text-truncate">
              To: {activeRoute.destinationName}
            </div>

            <div className="row g-2 py-2 border-top border-bottom my-2">
              <div className="col-6">
                <div className="text-muted" style={{ fontSize: '0.7rem' }}>ROAD DISTANCE</div>
                <div className="fs-5 fw-bold text-dark">{activeRoute.distanceKm}</div>
              </div>
              <div className="col-6">
                <div className="text-muted" style={{ fontSize: '0.7rem' }}>ESTIMATED TIME</div>
                <div className="fs-5 fw-bold text-primary">{activeRoute.durationMinutes}</div>
              </div>
            </div>

            <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
              <i className="bi bi-shield-check text-success me-1"></i>
              Road route computed along drivable streets via OpenStreetMap geometry.
            </div>
          </div>
        )}

        {/* Right Side Drawer: Destinations & Selection Info */}
        {sidebarOpen && (
          <div className="map-sidebar-drawer d-flex flex-column">
            {/* Header of Drawer */}
            <div className="p-3 border-bottom d-flex align-items-center justify-content-between bg-light">
              <div>
                <h6 className="fw-bold mb-0 text-dark">Destinations Explorer</h6>
                <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                  {places.length} Total • Click to Select & Route
                </div>
              </div>
              <span className="badge bg-secondary small text-capitalize">{activeCategory}</span>
            </div>

            {/* Selected Destination Action Card */}
            {selectedPlace && (
              <div className="p-3 border-bottom" style={{ backgroundColor: 'var(--rt-blue-50)' }}>
                <div className="d-flex justify-content-between align-items-start mb-1">
                  <span className="badge category-flat text-uppercase" style={{ fontSize: '0.7rem' }}>
                    {selectedPlace.category}
                  </span>
                  <span className={`badge ${selectedPlace.visited ? 'badge-rt-success' : 'badge-rt-warning'}`} style={{ fontSize: '0.7rem' }}>
                    {selectedPlace.visited ? 'Visited' : 'Pending'}
                  </span>
                </div>

                <h6 className="fw-bold text-dark mb-1">{selectedPlace.name}</h6>
                <p className="text-muted small mb-2 text-truncate">{selectedPlace.address}</p>

                {/* Coordinates Display (Feature 7) */}
                <div className="p-2 rounded bg-white border mb-2 small">
                  <div className="text-muted" style={{ fontSize: '0.7rem' }}>EXACT GPS COORDINATES</div>
                  <div className="fw-bold text-primary">
                    {isValidCoordinate(selectedPlace.latitude, selectedPlace.longitude)
                      ? `${Number(selectedPlace.latitude).toFixed(4)}°, ${Number(selectedPlace.longitude).toFixed(4)}°`
                      : 'Coordinates not set'}
                  </div>
                </div>

                {/* Route Button & Actions */}
                <div className="d-flex flex-column gap-2 mt-2">
                  <button
                    type="button"
                    className="btn btn-rt-accent btn-sm d-flex align-items-center justify-content-center gap-1"
                    onClick={() => calculateRoadRoute(selectedPlace)}
                    disabled={routeLoading || !isValidCoordinate(selectedPlace.latitude, selectedPlace.longitude)}
                  >
                    {routeLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                        Calculating Road Route...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-cursor-fill"></i> Route Along Actual Roads
                      </>
                    )}
                  </button>

                  <div className="d-flex gap-1">
                    <button
                      type="button"
                      className={`btn btn-sm flex-grow-1 ${
                        selectedPlace.visited ? 'btn-outline-secondary' : 'btn-outline-success'
                      }`}
                      onClick={() => handleToggleVisitFromMap(selectedPlace)}
                    >
                      <i className={`bi ${selectedPlace.visited ? 'bi-arrow-counterclockwise' : 'bi-check-lg'} me-1`}></i>
                      {selectedPlace.visited ? 'Mark Pending' : 'Mark Visited'}
                    </button>
                    <Link
                      to={`/places/edit/${selectedPlace.id}`}
                      className="btn btn-sm btn-outline-secondary px-2"
                      title="Edit Place"
                    >
                      <i className="bi bi-pencil"></i>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* List of Destinations */}
            <div className="flex-grow-1 overflow-auto p-2">
              {loading ? (
                <LoadingSpinner text="Loading markers..." />
              ) : places.length === 0 ? (
                <div className="text-center p-4">
                  <i className="bi bi-pin-map text-muted fs-2 d-block mb-2"></i>
                  <p className="text-muted small mb-3">No saved destinations yet.</p>
                  <Link to="/places/new" className="btn btn-rt-primary btn-sm">
                    Add First Place
                  </Link>
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {places.map((place) => {
                    const hasCoords = isValidCoordinate(place.latitude, place.longitude);
                    const isSelected = selectedPlace?.id === place.id;

                    return (
                      <div
                        key={place.id}
                        className={`p-3 rounded border transition cursor-pointer ${
                          isSelected
                            ? 'border-warning bg-warning-subtle shadow-sm'
                            : 'bg-white hover-shadow'
                        }`}
                        onClick={() => handleSelectPlace(place, true)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <span className="badge category-flat text-uppercase" style={{ fontSize: '0.68rem' }}>
                            {place.category || 'Rental'}
                          </span>
                          <span
                            className={`badge ${
                              isSelected
                                ? 'bg-warning text-dark'
                                : (place.visited ? 'badge-rt-success' : 'badge-rt-warning text-dark')
                            }`}
                            style={{
                              fontSize: '0.68rem',
                              backgroundColor: isSelected ? '#ea580c' : (place.visited ? '#10b981' : '#ea580c'),
                              color: '#ffffff',
                            }}
                          >
                            {isSelected ? 'Selected' : (place.visited ? 'Visited' : 'Pending')}
                          </span>
                        </div>

                        <div className="fw-bold text-dark small text-truncate">{place.name}</div>
                        <div className="text-muted text-truncate" style={{ fontSize: '0.75rem' }}>
                          {place.address || 'Address on record'}
                        </div>

                        <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                          <span className="fw-semibold text-dark small">{place.rent || place.price || 'Listing'}</span>
                          {hasCoords ? (
                            <span className="small text-muted" style={{ fontSize: '0.72rem' }}>
                              <i className="bi bi-geo-alt text-primary me-1"></i>
                              {Number(place.latitude).toFixed(3)}°, {Number(place.longitude).toFixed(3)}°
                            </span>
                          ) : (
                            <span className="badge bg-light text-danger border" style={{ fontSize: '0.68rem' }}>
                              No GPS Coords
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Add Destination Modal */}
      <QuickAddPlaceModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        initialCoordinates={quickAddCoords}
        onSuccess={(newPlace) => {
          setPlaces((prev) => [newPlace, ...prev]);
          if (newPlace.latitude && newPlace.longitude && leafletMapInstance.current) {
            leafletMapInstance.current.setView([newPlace.latitude, newPlace.longitude], 16);
            setSelectedPlace(newPlace);
          }
        }}
      />
    </div>
  );
};

export default MapExplorerPage;
