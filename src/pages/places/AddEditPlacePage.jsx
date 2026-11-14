import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { propertyService, geocodingService } from '../../services';
import { isValidCoordinate } from '../../utils/validators';
import { calculateDistanceMeters, formatDistance } from '../../utils/formatters';
import Modal from '../../components/common/Modal';

const AMENITIES_OPTIONS = [
  'Parking Available',
  'Wi-Fi Included',
  'Attached Bathroom',
  'Kitchen / Modular',
  'Air Conditioning',
  'Power Backup',
  'Security / CCTV',
  'Food / Mess Included',
  'Balcony',
  'Washing Machine',
  'Gated Community',
  'Furnished',
];

const AddEditPlacePage = () => {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [searchParams] = useSearchParams();

  const { user } = useAuth();
  const { showSuccess, showError, showInfo, showWarning } = useNotification();
  const navigate = useNavigate();

  const miniMapContainer = useRef(null);
  const miniMapInstance = useRef(null);
  const markerInstance = useRef(null);

  const initialLat = searchParams.get('lat') || '';
  const initialLng = searchParams.get('lng') || '';

  const [formData, setFormData] = useState({
    name: '',
    category: 'flat',
    customCategory: '',
    priority: 'medium',
    rent: '',
    address: '',
    city: user?.city || 'Bengaluru, India',
    latitude: initialLat,
    longitude: initialLng,
    contactPerson: '',
    contactPhone: '',
    notes: '',
    visited: false,
    amenities: [],
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [detectingGPS, setDetectingGPS] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [detectionStatus, setDetectionStatus] = useState(null); // { type: 'success' | 'suggest' | 'warning', message: string }
  const performReverseGeocodeRef = useRef(null);
  const [allPlaces, setAllPlaces] = useState([]);
  const [duplicatePlace, setDuplicatePlace] = useState(null);
  const [allowDuplicateSave, setAllowDuplicateSave] = useState(false);

  // Load existing places to check duplicate visits
  useEffect(() => {
    const loadAllPlaces = async () => {
      try {
        const places = await propertyService.getAll();
        setAllPlaces(places);
      } catch (e) {
        console.warn('Failed to load places for duplicate prevention check', e);
      }
    };
    loadAllPlaces();
  }, []);

  // If in edit mode, fetch existing place
  useEffect(() => {
    if (isEditMode) {
      const fetchPlace = async () => {
        setLoading(true);
        try {
          const place = await propertyService.getById(id);
          if (place) {
            setFormData({
              name: place.name || '',
              category: place.category || 'flat',
              priority: place.priority || 'medium',
              rent: place.rent || '',
              address: place.address || '',
              city: place.city || '',
              latitude: place.latitude ?? '',
              longitude: place.longitude ?? '',
              contactPerson: place.contactPerson || '',
              contactPhone: place.contactPhone || '',
              notes: place.notes || '',
              visited: place.visited || false,
              amenities: place.amenities || [],
            });
          }
        } catch (err) {
          showError('Failed to load place details for editing.');
          navigate('/places');
        } finally {
          setLoading(false);
        }
      };

      fetchPlace();
    }
  }, [id, isEditMode, navigate, showError]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleAmenityToggle = (amenity) => {
    setFormData((prev) => {
      const exists = prev.amenities.includes(amenity);
      return {
        ...prev,
        amenities: exists
          ? prev.amenities.filter((a) => a !== amenity)
          : [...prev.amenities, amenity],
      };
    });
  };

  const performReverseGeocode = async (lat, lng, source = 'gps') => {
    setDetectingLocation(true);
    try {
      const result = await geocodingService.reverseGeocode({ latitude: lat, longitude: lng });

      if (result && result.success) {
        setFormData((prev) => {
          const next = { ...prev, latitude: lat, longitude: lng };
          if (result.address) next.address = result.address;
          if (result.city) next.city = result.city;
          if (result.hasRecognizedName && result.placeName) {
            next.name = result.placeName;
          }
          if (result.category && (prev.category === 'flat' || !prev.category)) {
            next.category = result.category;
          }
          return next;
        });

        // Clear validation errors for auto-filled fields
        setErrors((prev) => ({
          ...prev,
          coordinates: null,
          address: result.address ? null : prev.address,
          name: result.hasRecognizedName ? null : prev.name,
        }));

        setLocationSuggestions(result.suggestions || []);

        if (result.hasRecognizedName && result.placeName) {
          setDetectionStatus({
            type: 'success',
            message: `Location detected: ${result.placeName}`,
          });
          showSuccess(`Location detected: ${result.placeName}`);
        } else {
          setDetectionStatus({
            type: 'suggest',
            message: 'Could not identify this exact place.',
          });
          if (source === 'gps') {
            showInfo('GPS coordinates obtained. Please select a suggested locality or type a place name.');
          } else {
            showInfo('Location pinned. Select a suggested locality or type a place name.');
          }
        }
      } else {
        // Reverse geocoding failed or returned error, but preserve coordinates
        setFormData((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));
        setLocationSuggestions([]);
        setDetectionStatus({
          type: 'warning',
          message: result?.error || 'Could not auto-detect address. Please enter details manually.',
        });
        showWarning(result?.error || 'Could not auto-detect address details. Please fill manually.');
      }
    } catch (e) {
      console.warn('Reverse geocode error:', e);
      setFormData((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
      }));
      setDetectionStatus({
        type: 'warning',
        message: 'Location service temporarily unavailable. Please enter details manually.',
      });
      showWarning('Location service unavailable. You can enter details manually.');
    } finally {
      setDetectingLocation(false);
      setDetectingGPS(false);
    }
  };

  performReverseGeocodeRef.current = performReverseGeocode;

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      showError('Geolocation is not supported by your browser.');
      return;
    }

    setDetectingGPS(true);
    setDetectionStatus(null);
    showInfo('Requesting GPS location...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setFormData((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));

        if (miniMapInstance.current && markerInstance.current) {
          markerInstance.current.setLatLng([lat, lng]);
          miniMapInstance.current.setView([lat, lng], 16);
        }

        // Full location detection process: coordinates, address, city, and place name
        performReverseGeocode(lat, lng, 'gps');
      },
      (err) => {
        setDetectingGPS(false);
        setDetectingLocation(false);
        if (err.code === 1 || err.message?.toLowerCase().includes('denied')) {
          showError('Location permission denied. Please allow location access in your browser or enter coordinates manually.');
          setDetectionStatus({
            type: 'warning',
            message: 'Location permission denied. Please allow access or enter coordinates manually.',
          });
        } else {
          showError(`Could not detect location: ${err.message}`);
          setDetectionStatus({
            type: 'warning',
            message: `GPS error: ${err.message}`,
          });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Initialize interactive Leaflet mini-map picker
  useEffect(() => {
    if (!miniMapContainer.current) return;

    const defaultLat = formData.latitude ? parseFloat(formData.latitude) : (user?.homeCoordinates?.lat || 12.9716);
    const defaultLng = formData.longitude ? parseFloat(formData.longitude) : (user?.homeCoordinates?.lng || 77.5946);

    if (!miniMapInstance.current) {
      const map = L.map(miniMapContainer.current, {
        center: [defaultLat, defaultLng],
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const customPin = L.divIcon({
        className: 'custom-pin',
        html: `
          <div style="background-color: #ea580c; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
            <span style="transform: rotate(45deg); color: #ffffff; font-size: 13px;"><i class="bi bi-geo-alt"></i></span>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      });

      const marker = L.marker([defaultLat, defaultLng], { icon: customPin }).addTo(map);
      markerInstance.current = marker;
      miniMapInstance.current = map;

      // Click to pick coordinates directly on map and trigger reverse geocoding auto-fill
      map.on('click', (e) => {
        const lat = Number(e.latlng.lat.toFixed(6));
        const lng = Number(e.latlng.lng.toFixed(6));
        marker.setLatLng([lat, lng]);
        map.panTo([lat, lng]);
        if (performReverseGeocodeRef.current) {
          performReverseGeocodeRef.current(lat, lng, 'map');
        }
      });
    }

    return () => {
      if (miniMapInstance.current) {
        miniMapInstance.current.remove();
        miniMapInstance.current = null;
      }
    };
  }, []);

  // Sync marker on coordinate changes
  useEffect(() => {
    if (
      miniMapInstance.current &&
      markerInstance.current &&
      isValidCoordinate(formData.latitude, formData.longitude)
    ) {
      const lat = parseFloat(formData.latitude);
      const lng = parseFloat(formData.longitude);
      markerInstance.current.setLatLng([lat, lng]);
      miniMapInstance.current.panTo([lat, lng]);
    }
  }, [formData.latitude, formData.longitude]);

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Destination / Place name is required.';
    if (!formData.address.trim()) errs.address = 'Address is required for navigation.';

    if (
      (formData.latitude || formData.longitude) &&
      !isValidCoordinate(formData.latitude, formData.longitude)
    ) {
      errs.coordinates = 'Please enter valid latitude (-90 to 90) and longitude (-180 to 180).';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Check duplicate visit: if not in edit mode and duplicate not explicitly confirmed
    if (!isEditMode && !allowDuplicateSave) {
      const existingDuplicate = allPlaces.find((p) => {
        if (
          formData.latitude &&
          formData.longitude &&
          p.latitude &&
          p.longitude &&
          isValidCoordinate(p.latitude, p.longitude)
        ) {
          const dist = calculateDistanceMeters(
            Number(formData.latitude),
            Number(formData.longitude),
            Number(p.latitude),
            Number(p.longitude)
          );
          if (dist <= 60) return true;
        }
        return (
          p.name?.trim().toLowerCase() === formData.name?.trim().toLowerCase() &&
          p.address?.trim().toLowerCase() === formData.address?.trim().toLowerCase()
        );
      });

      if (existingDuplicate) {
        setDuplicatePlace(existingDuplicate);
        return;
      }
    }

    setLoading(true);
    try {
      const effectiveCategory =
        formData.category === 'other' && formData.customCategory?.trim()
          ? formData.customCategory.trim().toLowerCase()
          : formData.category;

      const payload = {
        ...formData,
        category: effectiveCategory,
        userId: user?.id,
        latitude: formData.latitude !== '' ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude !== '' ? parseFloat(formData.longitude) : null,
      };

      if (isEditMode) {
        await propertyService.update(id, payload);
        showSuccess(`Destination "${formData.name}" updated successfully.`);
      } else {
        await propertyService.create(payload);
        showSuccess(`Destination "${formData.name}" added successfully.`);
      }

      navigate('/places');
    } catch (err) {
      showError(err.message || 'Failed to save destination.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDuplicateSave = async () => {
    setAllowDuplicateSave(true);
    setDuplicatePlace(null);
    setLoading(true);

    try {
      const effectiveCategory =
        formData.category === 'other' && formData.customCategory?.trim()
          ? formData.customCategory.trim().toLowerCase()
          : formData.category;

      const payload = {
        ...formData,
        category: effectiveCategory,
        userId: user?.id,
        latitude: formData.latitude !== '' ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude !== '' ? parseFloat(formData.longitude) : null,
        isIntentionalRevisit: Boolean(duplicatePlace?.visited),
      };

      await propertyService.create(payload);
      showSuccess(`Destination "${formData.name}" saved as an intentional visit.`);
      navigate('/places');
    } catch (err) {
      showError(err.message || 'Failed to save destination.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">{isEditMode ? 'Edit Destination' : 'Save New Destination'}</h2>
          <p className="page-subtitle">
            {isEditMode
              ? 'Update listing details, rent, contact info, or GPS coordinates'
              : 'Add a new PG, flat, rental room, or travel spot to your tracking map'}
          </p>
        </div>
        <Link to="/places" className="btn btn-rt-secondary btn-sm">
          <i className="bi bi-arrow-left"></i> Back to Places
        </Link>
      </div>

      <div className="row justify-content-center">
        <div className="col-lg-10">
          <div className="rt-card">
            <div className="rt-card-header">
              <div className="d-flex align-items-center gap-2">
                <i className={`bi ${isEditMode ? 'bi-pencil-square' : 'bi-plus-circle'} text-primary`}></i>
                <h6 className="fw-bold mb-0 text-dark">
                  {isEditMode ? 'Destination Details' : 'New Destination Information'}
                </h6>
              </div>
              <span className="badge bg-light text-secondary border">
                {isEditMode ? `ID: ${id}` : 'Draft'}
              </span>
            </div>

            <div className="rt-card-body">
              <form onSubmit={handleSubmit} noValidate>
                {/* Basic Details Section */}
                <h6 className="fw-bold text-dark mb-3 border-bottom pb-2">1. Basic Information</h6>
                <div className="row g-3 mb-4">
                  {/* Name */}
                  <div className="col-md-6">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <label className="form-label mb-0">Place / Property Name *</label>
                      {detectingLocation && (
                        <span className="badge bg-primary-subtle text-primary border" style={{ fontSize: '0.72rem' }}>
                          <span
                            className="spinner-border spinner-border-sm me-1"
                            style={{ width: '0.7rem', height: '0.7rem' }}
                            role="status"
                          ></span>
                          Detecting location details...
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      name="name"
                      className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                      placeholder="e.g. Greenview 2BHK Apartment, Stanza PG, Orion Mall"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                    {errors.name && <div className="invalid-feedback">{errors.name}</div>}

                    {/* Auto-Detection Status & Suggestions */}
                    {detectionStatus?.type === 'success' && (
                      <div className="mt-2 p-2 rounded bg-success-subtle border border-success-subtle d-flex align-items-center justify-content-between">
                        <span className="small text-success fw-semibold">
                          <i className="bi bi-geo-alt-fill me-1"></i> {detectionStatus.message}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-muted p-0 ms-2"
                          onClick={() => setDetectionStatus(null)}
                          title="Dismiss"
                        >
                          <i className="bi bi-x-lg"></i>
                        </button>
                      </div>
                    )}

                    {detectionStatus?.type === 'suggest' && (
                      <div className="mt-2 p-3 rounded bg-light border">
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <div className="small fw-semibold text-dark">
                            <i className="bi bi-exclamation-circle text-warning me-1"></i>
                            Could not identify this exact place.
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-link text-muted p-0"
                            onClick={() => setDetectionStatus(null)}
                            title="Dismiss"
                          >
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </div>
                        {locationSuggestions.length > 0 ? (
                          <>
                            <div className="small text-muted mb-2">
                              Suggested nearby localities or roads:
                            </div>
                            <div className="d-flex flex-wrap gap-1 mb-2">
                              {locationSuggestions.map((suggestion, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  className="btn btn-sm btn-outline-primary py-0 px-2 rounded-pill"
                                  style={{ fontSize: '0.78rem' }}
                                  onClick={() => {
                                    setFormData((prev) => ({ ...prev, name: suggestion }));
                                    setErrors((prev) => ({ ...prev, name: null }));
                                    showSuccess(`Selected: "${suggestion}"`);
                                  }}
                                >
                                  <i className="bi bi-plus me-1"></i>
                                  {suggestion}
                                </button>
                              ))}
                            </div>
                            <div className="text-muted" style={{ fontSize: '0.73rem' }}>
                              Click a suggestion to set as destination name, or type any custom name above.
                            </div>
                          </>
                        ) : (
                          <div className="text-muted small">
                            No specific POI found for these coordinates. Please type a custom destination name above.
                          </div>
                        )}
                      </div>
                    )}

                    {detectionStatus?.type === 'warning' && (
                      <div className="mt-2 p-2 rounded bg-warning-subtle border border-warning-subtle d-flex align-items-center justify-content-between">
                        <span className="small text-warning-emphasis">
                          <i className="bi bi-info-circle me-1"></i> {detectionStatus.message}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-link text-muted p-0 ms-2"
                          onClick={() => setDetectionStatus(null)}
                        >
                          <i className="bi bi-x-lg"></i>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Category */}
                  <div className={formData.category === 'other' ? 'col-md-2' : 'col-md-3'}>
                    <label className="form-label">Category *</label>
                    <select
                      name="category"
                      className="form-select"
                      value={formData.category}
                      onChange={handleChange}
                    >
                      <option value="pg">PG / Co-Living</option>
                      <option value="room">Single Room</option>
                      <option value="flat">Flat / Apartment</option>
                      <option value="house">Independent House</option>
                      <option value="restaurant">Restaurant / Cafe</option>
                      <option value="shopping">Shopping / Mall</option>
                      <option value="hospital">Hospital / Clinic</option>
                      <option value="office">Office / Workplace</option>
                      <option value="tourist">Tourist Place / Landmark</option>
                      <option value="other">Other (Custom Category)</option>
                    </select>
                  </div>

                  {formData.category === 'other' && (
                    <div className="col-md-2">
                      <label className="form-label">Custom Category</label>
                      <input
                        type="text"
                        name="customCategory"
                        className="form-control"
                        placeholder="e.g. Library, Park"
                        value={formData.customCategory || ''}
                        onChange={handleChange}
                      />
                    </div>
                  )}

                  {/* Priority */}
                  <div className={formData.category === 'other' ? 'col-md-2' : 'col-md-3'}>
                    <label className="form-label">Visit Priority</label>
                    <select
                      name="priority"
                      className="form-select"
                      value={formData.priority}
                      onChange={handleChange}
                    >
                      <option value="high">High Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="low">Low Priority</option>
                    </select>
                  </div>

                  {/* Rent / Budget */}
                  <div className="col-md-6">
                    <label className="form-label">Target Rent / Budget</label>
                    <div className="input-group">
                      <span className="input-group-text bg-white">
                        <i className="bi bi-tag text-muted"></i>
                      </span>
                      <input
                        type="text"
                        name="rent"
                        className="form-control"
                        placeholder="e.g. ₹28,000 / mo or ₹12,000 / bed"
                        value={formData.rent}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  {/* Visit Status Toggle */}
                  <div className="col-md-6 d-flex align-items-center">
                    <div className="form-check form-switch mt-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id="visitedSwitch"
                        name="visited"
                        checked={formData.visited}
                        onChange={handleChange}
                      />
                      <label className="form-check-label fw-semibold text-dark" htmlFor="visitedSwitch">
                        Mark as Already Visited
                      </label>
                      <div className="text-muted small">
                        Visited places are tracked separately to avoid accidental duplicate visits.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Location & GPS Section */}
                <h6 className="fw-bold text-dark mb-3 border-bottom pb-2">2. Location & Coordinates</h6>
                <div className="row g-3 mb-4">
                  <div className="col-md-8">
                    <label className="form-label">Street Address *</label>
                    <input
                      type="text"
                      name="address"
                      className={`form-control ${errors.address ? 'is-invalid' : ''}`}
                      placeholder="e.g. #42, 12th Main Road, HAL 2nd Stage, Indiranagar"
                      value={formData.address}
                      onChange={handleChange}
                      required
                    />
                    {errors.address && <div className="invalid-feedback">{errors.address}</div>}
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">City / Region</label>
                    <input
                      type="text"
                      name="city"
                      className="form-control"
                      placeholder="e.g. Bengaluru, India"
                      value={formData.city}
                      onChange={handleChange}
                    />
                  </div>

                  {/* GPS Coordinates & Detection */}
                  <div className="col-12">
                    <div className="p-3 rounded border bg-light">
                      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                        <div>
                          <label className="form-label fw-bold mb-0">GPS Coordinates & Location Detection (Optional)</label>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                            Automatically captures coordinates, reverses geocodes street address, city, and detects place name.
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                          onClick={handleDetectGPS}
                          disabled={detectingGPS || detectingLocation}
                        >
                          {detectingGPS || detectingLocation ? (
                            <>
                              <span className="spinner-border spinner-border-sm" role="status"></span>
                              Detecting Location Details...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-crosshair"></i>
                              Use Current GPS & Auto-Fill
                            </>
                          )}
                        </button>
                      </div>

                      <div className="row g-2">
                        <div className="col-sm-6">
                          <input
                            type="number"
                            step="any"
                            name="latitude"
                            className={`form-control ${errors.coordinates ? 'is-invalid' : ''}`}
                            placeholder="Latitude (e.g. 12.9716)"
                            value={formData.latitude}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="col-sm-6">
                          <input
                            type="number"
                            step="any"
                            name="longitude"
                            className={`form-control ${errors.coordinates ? 'is-invalid' : ''}`}
                            placeholder="Longitude (e.g. 77.5946)"
                            value={formData.longitude}
                            onChange={handleChange}
                          />
                        </div>
                        {errors.coordinates && (
                          <div className="col-12 text-danger small mt-1">{errors.coordinates}</div>
                        )}
                      </div>

                      {/* Interactive Mini-Map Coordinate Picker (Feature 9) */}
                      <div className="mt-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="small text-muted fw-semibold">
                            <i className="bi bi-pin-map text-primary me-1"></i> Or click anywhere on the map to pin location & auto-fill address details:
                          </span>
                          <span className="badge bg-light text-secondary border small">Interactive Map Picker</span>
                        </div>
                        <div
                          ref={miniMapContainer}
                          className="rounded border"
                          style={{ height: '220px', width: '100%', zIndex: 1 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact & Notes Section */}
                <h6 className="fw-bold text-dark mb-3 border-bottom pb-2">3. Contact & Details</h6>
                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <label className="form-label">Contact Person / Owner / Broker</label>
                    <input
                      type="text"
                      name="contactPerson"
                      className="form-control"
                      placeholder="e.g. Suresh (Owner) or Indiranagar Realty"
                      value={formData.contactPerson}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Contact Phone Number</label>
                    <div className="input-group">
                      <span className="input-group-text bg-white">
                        <i className="bi bi-telephone text-muted"></i>
                      </span>
                      <input
                        type="tel"
                        name="contactPhone"
                        className="form-control"
                        placeholder="+91 98765 43210"
                        value={formData.contactPhone}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  {/* Amenities Checklist */}
                  <div className="col-12">
                    <label className="form-label fw-bold">Amenities & Features</label>
                    <div className="row g-2">
                      {AMENITIES_OPTIONS.map((amenity) => (
                        <div key={amenity} className="col-6 col-sm-4 col-md-3">
                          <div
                            className={`p-2 rounded border small cursor-pointer d-flex align-items-center gap-2 ${
                              formData.amenities.includes(amenity)
                                ? 'border-primary bg-primary-subtle text-primary fw-semibold'
                                : 'bg-white text-secondary'
                            }`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleAmenityToggle(amenity)}
                          >
                            <i
                              className={`bi ${
                                formData.amenities.includes(amenity)
                                  ? 'bi-check-square-fill text-primary'
                                  : 'bi-square text-muted'
                              }`}
                            ></i>
                            <span className="text-truncate">{amenity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="col-12">
                    <label className="form-label">Visit Notes / Rental Terms</label>
                    <textarea
                      name="notes"
                      rows="3"
                      className="form-control"
                      placeholder="e.g. Advance deposit 5 months, water tanker extra, owner lives on ground floor, 24/7 security."
                      value={formData.notes}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="pt-3 border-top d-flex justify-content-end gap-2">
                  <Link to="/places" className="btn btn-rt-secondary">
                    Cancel
                  </Link>
                  <button type="submit" className="btn btn-rt-primary" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-lg"></i>
                        {isEditMode ? 'Update Destination' : 'Save Destination'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Duplicate Visit / Location Prevention Modal */}
      <Modal
        isOpen={Boolean(duplicatePlace)}
        onClose={() => setDuplicatePlace(null)}
        title="Duplicate Destination Alert"
        size="md"
        footer={
          <div className="d-flex justify-content-between align-items-center w-100 flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setDuplicatePlace(null)}
            >
              Cancel / Adjust Coordinates
            </button>
            <button
              type="button"
              className="btn btn-sm btn-rt-primary"
              onClick={handleConfirmDuplicateSave}
            >
              <i className="bi bi-check2-circle me-1"></i> Save as Intentional Listing / Revisit
            </button>
          </div>
        }
      >
        {duplicatePlace && (
          <div>
            <div className="text-center mb-3">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                style={{
                  width: '52px',
                  height: '52px',
                  backgroundColor: '#fffbeb',
                  color: '#d97706',
                  fontSize: '1.75rem',
                }}
              >
                <i className="bi bi-exclamation-triangle"></i>
              </div>
              <h5 className="fw-bold text-dark mb-1">Potential Duplicate Destination</h5>
              <p className="text-muted small">
                RoomTrail detected that you already have a saved location at or very close to this spot.
              </p>
            </div>

            <div className="p-3 rounded bg-light border mb-3">
              <div className="d-flex justify-content-between small text-muted mb-1">
                <span>Existing Place Name:</span>
                <strong className="text-dark">{duplicatePlace.name}</strong>
              </div>
              <div className="d-flex justify-content-between small text-muted mb-1">
                <span>Category:</span>
                <strong className="text-dark text-uppercase">{duplicatePlace.category}</strong>
              </div>
              <div className="d-flex justify-content-between small text-muted mb-1">
                <span>Existing Address:</span>
                <span className="text-dark">{duplicatePlace.address}</span>
              </div>
              <div className="d-flex justify-content-between small text-muted">
                <span>Visit Status:</span>
                <span className={`badge ${duplicatePlace.visited ? 'badge-rt-success' : 'badge-rt-primary'}`}>
                  {duplicatePlace.visited ? 'Already Visited' : 'Pending Visit'}
                </span>
              </div>
            </div>

            <div className="small text-muted">
              {duplicatePlace.visited ? (
                <div className="alert alert-info py-2 px-3 mb-0 small">
                  <i className="bi bi-info-circle me-1 text-primary"></i>
                  This destination was previously visited. If you are planning a return visit, click below to confirm as an intentional revisit.
                </div>
              ) : (
                <div className="alert alert-secondary py-2 px-3 mb-0 small">
                  <i className="bi bi-info-circle me-1"></i>
                  To avoid redundant travel or confusing your itinerary, you may cancel to edit coordinates or save if this is a distinct unit/room at the same building.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AddEditPlacePage;
