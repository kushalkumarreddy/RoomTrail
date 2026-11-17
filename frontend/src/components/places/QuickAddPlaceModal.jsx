import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { propertyService, geocodingService } from '../../services';
import { isValidCoordinate } from '../../utils/validators';
import Modal from '../common/Modal';

const CATEGORY_OPTIONS = [
  { value: 'pg', label: 'PG / Co-Living' },
  { value: 'room', label: 'Single Room' },
  { value: 'flat', label: 'Flat / Apartment' },
  { value: 'house', label: 'Independent House' },
  { value: 'restaurant', label: 'Restaurant / Cafe' },
  { value: 'shopping', label: 'Shopping / Mall' },
  { value: 'hospital', label: 'Hospital / Clinic' },
  { value: 'office', label: 'Office / Workplace' },
  { value: 'tourist', label: 'Tourist Place / Landmark' },
  { value: 'other', label: 'Other (Custom Category)' },
];

const QUICK_FACILITIES = [
  'Parking Available',
  'Wi-Fi Included',
  'Attached Bathroom',
  'Air Conditioning',
  'Food / Mess',
  'Security / CCTV',
];

const QuickAddPlaceModal = ({
  isOpen,
  onClose,
  onSuccess,
  initialCoordinates = null,
}) => {
  const { user } = useAuth();
  const { showSuccess, showError, showInfo, showWarning } = useNotification();

  const [formData, setFormData] = useState({
    name: '',
    category: 'flat',
    customCategory: '',
    address: '',
    city: user?.city || 'Bengaluru, India',
    latitude: '',
    longitude: '',
    priority: 'medium',
    rent: '',
    contactPerson: '',
    contactPhone: '',
    notes: '',
    visited: false,
    amenities: [],
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [detectionStatus, setDetectionStatus] = useState(null); // { type: 'success'|'suggest'|'warning', message: string }
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(false);

  const miniMapContainer = useRef(null);
  const miniMapInstance = useRef(null);
  const markerInstance = useRef(null);
  const performReverseGeocodeRef = useRef(null);

  // Reset or pre-populate when modal opens
  useEffect(() => {
    if (isOpen) {
      const defaultLat = initialCoordinates?.lat ?? '';
      const defaultLng = initialCoordinates?.lng ?? '';

      setFormData({
        name: '',
        category: 'flat',
        customCategory: '',
        address: '',
        city: user?.city || 'Bengaluru, India',
        latitude: defaultLat !== '' ? String(defaultLat) : '',
        longitude: defaultLng !== '' ? String(defaultLng) : '',
        priority: 'medium',
        rent: '',
        contactPerson: '',
        contactPhone: '',
        notes: '',
        visited: false,
        amenities: [],
      });
      setErrors({});
      setDetectionStatus(null);
      setLocationSuggestions([]);
      setShowAdvanced(false);
      setShowMiniMap(false);

      // If initial coordinates provided (e.g. from active tracking or map click), auto reverse-geocode
      if (isValidCoordinate(defaultLat, defaultLng)) {
        setTimeout(() => {
          performReverseGeocode(Number(defaultLat), Number(defaultLng), 'initial');
        }, 150);
      }
    }
  }, [isOpen, initialCoordinates]);

  // Reverse Geocoding Routine
  const performReverseGeocode = async (lat, lng, source = 'gps') => {
    setDetectingLocation(true);
    try {
      const result = await geocodingService.reverseGeocode({ latitude: lat, longitude: lng });

      if (result && result.success) {
        setFormData((prev) => {
          const next = {
            ...prev,
            latitude: lat,
            longitude: lng,
          };
          if (result.address) next.address = result.address;
          if (result.city) next.city = result.city;
          if (result.hasRecognizedName && result.placeName) {
            next.name = result.placeName;
          }
          if (result.category && (prev.category === 'flat' || !prev.category)) {
            next.category = result.category === 'travel' ? 'tourist' : result.category;
          }
          return next;
        });

        // Clear validation errors
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
            message: 'Could not identify exact POI name. Choose a suggestion or enter a name.',
          });
        }
      } else {
        // Reverse geocode failed or partial, preserve coordinates
        setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
        setDetectionStatus({
          type: 'warning',
          message: result?.error || 'Could not auto-detect address. Please enter details manually.',
        });
        showWarning('Location service unavailable. You can enter details manually.');
      }
    } catch (e) {
      console.warn('Quick add reverse geocode error', e);
      setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
      setDetectionStatus({
        type: 'warning',
        message: 'Could not connect to location services. Enter details manually.',
      });
    } finally {
      setDetectingLocation(false);
    }
  };

  performReverseGeocodeRef.current = performReverseGeocode;

  // Use Current GPS handler
  const handleUseCurrentGPS = () => {
    if (!navigator.geolocation) {
      showError('Geolocation is not supported by your browser.');
      return;
    }

    setDetectingLocation(true);
    setDetectionStatus(null);
    showInfo('Requesting current GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));

        setFormData((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));

        // Reposition mini-map if open
        if (miniMapInstance.current && markerInstance.current) {
          markerInstance.current.setLatLng([lat, lng]);
          miniMapInstance.current.setView([lat, lng], 16);
        }

        // Full location identification process
        performReverseGeocode(lat, lng, 'gps');
      },
      (err) => {
        setDetectingLocation(false);
        if (err.code === 1 || err.message?.toLowerCase().includes('denied')) {
          showError('Location permission denied. Please enter coordinates manually.');
          setDetectionStatus({
            type: 'warning',
            message: 'GPS permission denied. Please enter details manually.',
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

  // Mini-Map Initialization (Collapsible)
  useEffect(() => {
    if (!showMiniMap || !miniMapContainer.current) return;

    const lat = formData.latitude ? parseFloat(formData.latitude) : (user?.homeCoordinates?.lat || 12.9716);
    const lng = formData.longitude ? parseFloat(formData.longitude) : (user?.homeCoordinates?.lng || 77.5946);

    if (!miniMapInstance.current) {
      const map = L.map(miniMapContainer.current, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const customPin = L.divIcon({
        className: 'custom-pin',
        html: `
          <div style="background-color: #ea580c; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
            <span style="transform: rotate(45deg); color: #ffffff; font-size: 12px;"><i class="bi bi-geo-alt-fill"></i></span>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });

      const marker = L.marker([lat, lng], { icon: customPin }).addTo(map);
      markerInstance.current = marker;
      miniMapInstance.current = map;

      map.on('click', (e) => {
        const clickLat = Number(e.latlng.lat.toFixed(6));
        const clickLng = Number(e.latlng.lng.toFixed(6));
        marker.setLatLng([clickLat, clickLng]);
        map.panTo([clickLat, clickLng]);
        if (performReverseGeocodeRef.current) {
          performReverseGeocodeRef.current(clickLat, clickLng, 'map');
        }
      });

      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    }

    return () => {
      if (miniMapInstance.current) {
        miniMapInstance.current.remove();
        miniMapInstance.current = null;
      }
    };
  }, [showMiniMap]);

  // Form input changes
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

  const handleFacilityToggle = (facility) => {
    setFormData((prev) => {
      const exists = prev.amenities.includes(facility);
      return {
        ...prev,
        amenities: exists
          ? prev.amenities.filter((f) => f !== facility)
          : [...prev.amenities, facility],
      };
    });
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Place / Destination name is required.';
    if (!formData.address.trim()) errs.address = 'Street address is required.';
    if (
      (formData.latitude || formData.longitude) &&
      !isValidCoordinate(formData.latitude, formData.longitude)
    ) {
      errs.coordinates = 'Please provide valid coordinates (-90 to 90, -180 to 180).';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const effectiveCategory =
        formData.category === 'other' && formData.customCategory.trim()
          ? formData.customCategory.trim().toLowerCase()
          : formData.category;

      const payload = {
        userId: user?.id || '1',
        name: formData.name.trim(),
        category: effectiveCategory,
        address: formData.address.trim(),
        city: formData.city.trim() || 'Bengaluru, India',
        latitude: formData.latitude !== '' ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude !== '' ? parseFloat(formData.longitude) : null,
        rent: formData.rent.trim(),
        priority: formData.priority,
        contactPerson: formData.contactPerson.trim(),
        contactPhone: formData.contactPhone.trim(),
        notes: formData.notes.trim(),
        visited: Boolean(formData.visited),
        amenities: formData.amenities,
      };

      const created = await propertyService.create(payload);
      showSuccess(`Destination "${created.name}" saved successfully!`);

      if (onSuccess) {
        onSuccess(created);
      }
      onClose();
    } catch (err) {
      console.error('Failed to save quick destination', err);
      showError(err.message || 'Failed to save destination.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        <div className="d-flex align-items-center gap-2">
          <div
            className="rounded-circle d-flex align-items-center justify-content-center text-white"
            style={{ width: '32px', height: '32px', backgroundColor: '#0284c7' }}
          >
            <i className="bi bi-geo-alt-fill" style={{ fontSize: '15px' }}></i>
          </div>
          <div>
            <div className="fw-bold text-dark" style={{ fontSize: '1.05rem' }}>
              Quick Add Destination
            </div>
            <div className="text-muted fw-normal" style={{ fontSize: '0.75rem' }}>
              Save a newly discovered place while travelling or exploring
            </div>
          </div>
        </div>
      }
      footer={
        <div className="d-flex justify-content-between align-items-center w-100 flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-rt-primary px-4"
            onClick={handleSubmit}
            disabled={saving || detectingLocation}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                Saving Destination...
              </>
            ) : (
              <>
                <i className="bi bi-check2-circle me-1"></i> Save Destination
              </>
            )}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {/* GPS Quick Action Bar */}
        <div className="p-3 rounded border mb-3" style={{ backgroundColor: '#f0f9ff' }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <div className="fw-bold text-dark small">
                <i className="bi bi-crosshair text-primary me-1"></i> Location Detection & Coordinates
              </div>
              <div className="text-muted" style={{ fontSize: '0.73rem' }}>
                Auto-fills coordinates, street address, city, and recognizable place name.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1 shadow-xs"
              onClick={handleUseCurrentGPS}
              disabled={detectingLocation}
            >
              {detectingLocation ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  Detecting GPS & Address...
                </>
              ) : (
                <>
                  <i className="bi bi-cursor-fill"></i> Use Current GPS
                </>
              )}
            </button>
          </div>
        </div>

        {/* Essential Destination Fields */}
        <div className="row g-3 mb-3">
          {/* Place Name */}
          <div className="col-md-7">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <label className="form-label mb-0 fw-semibold">Place / Destination Name *</label>
              {detectingLocation && (
                <span className="badge bg-primary-subtle text-primary border" style={{ fontSize: '0.7rem' }}>
                  <span className="spinner-border spinner-border-sm me-1" style={{ width: '0.65rem', height: '0.65rem' }}></span>
                  Detecting...
                </span>
              )}
            </div>
            <input
              type="text"
              name="name"
              className={`form-control ${errors.name ? 'is-invalid' : ''}`}
              placeholder="e.g. Orion Mall, Chai Point, Sunshine PG"
              value={formData.name}
              onChange={handleChange}
              required
            />
            {errors.name && <div className="invalid-feedback">{errors.name}</div>}

            {/* Auto-Detection Feedback */}
            {detectionStatus?.type === 'success' && (
              <div className="mt-2 p-2 rounded bg-success-subtle border border-success-subtle d-flex align-items-center justify-content-between">
                <span className="small text-success fw-semibold">
                  <i className="bi bi-geo-alt-fill me-1"></i> {detectionStatus.message}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-link text-muted p-0"
                  onClick={() => setDetectionStatus(null)}
                >
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            )}

            {/* Suggestions Chips when ambiguous */}
            {detectionStatus?.type === 'suggest' && locationSuggestions.length > 0 && (
              <div className="mt-2 p-2 rounded bg-light border">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="small text-muted fw-semibold" style={{ fontSize: '0.75rem' }}>
                    Suggested localities / roads:
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-link text-muted p-0"
                    onClick={() => setDetectionStatus(null)}
                  >
                    <i className="bi bi-x-lg"></i>
                  </button>
                </div>
                <div className="d-flex flex-wrap gap-1">
                  {locationSuggestions.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      className="btn btn-sm btn-outline-primary py-0 px-2 rounded-pill"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => {
                        setFormData((p) => ({ ...p, name: sug }));
                        setErrors((p) => ({ ...p, name: null }));
                        showSuccess(`Applied: "${sug}"`);
                      }}
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Category Selection (Requirement 4) */}
          <div className="col-md-5">
            <label className="form-label fw-semibold">Category *</label>
            <select
              name="category"
              className="form-select"
              value={formData.category}
              onChange={handleChange}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Category Field if 'other' is selected */}
          {formData.category === 'other' && (
            <div className="col-12">
              <label className="form-label small fw-semibold text-primary">Enter Custom Category</label>
              <input
                type="text"
                name="customCategory"
                className="form-control"
                placeholder="e.g. Library, Gas Station, Gym, Viewpoint"
                value={formData.customCategory}
                onChange={handleChange}
              />
            </div>
          )}

          {/* Street Address */}
          <div className="col-md-8">
            <label className="form-label fw-semibold">Street Address *</label>
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

          {/* City / Region */}
          <div className="col-md-4">
            <label className="form-label fw-semibold">City / Region</label>
            <input
              type="text"
              name="city"
              className="form-control"
              placeholder="e.g. Bengaluru, India"
              value={formData.city}
              onChange={handleChange}
            />
          </div>

          {/* Coordinates Inputs & Map Toggle */}
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <label className="form-label small fw-bold mb-0 text-muted">
                GPS Coordinates (Latitude & Longitude)
              </label>
              <button
                type="button"
                className="btn btn-sm btn-link p-0 text-decoration-none text-primary small"
                onClick={() => setShowMiniMap(!showMiniMap)}
              >
                <i className={`bi ${showMiniMap ? 'bi-chevron-up' : 'bi-pin-map'} me-1`}></i>
                {showMiniMap ? 'Hide Map Picker' : 'Pick on Map'}
              </button>
            </div>

            <div className="row g-2">
              <div className="col-6">
                <input
                  type="number"
                  step="any"
                  name="latitude"
                  className={`form-control form-control-sm ${errors.coordinates ? 'is-invalid' : ''}`}
                  placeholder="Latitude (e.g. 12.9716)"
                  value={formData.latitude}
                  onChange={handleChange}
                />
              </div>
              <div className="col-6">
                <input
                  type="number"
                  step="any"
                  name="longitude"
                  className={`form-control form-control-sm ${errors.coordinates ? 'is-invalid' : ''}`}
                  placeholder="Longitude (e.g. 77.5946)"
                  value={formData.longitude}
                  onChange={handleChange}
                />
              </div>
            </div>
            {errors.coordinates && (
              <div className="text-danger small mt-1">{errors.coordinates}</div>
            )}

            {/* Embedded Mini-Map Coordinate Picker */}
            {showMiniMap && (
              <div className="mt-2">
                <div className="small text-muted mb-1">
                  Click anywhere on the map to set pin and auto-fill address:
                </div>
                <div
                  ref={miniMapContainer}
                  className="rounded border"
                  style={{ height: '180px', width: '100%', zIndex: 1 }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Optional Destination Details */}
        <div className="border-top pt-2 mt-3">
          <button
            type="button"
            className="btn btn-sm btn-link p-0 text-decoration-none fw-semibold d-flex align-items-center gap-1 text-secondary"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <i className={`bi ${showAdvanced ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
            {showAdvanced ? 'Hide Additional Details' : '+ Add Optional Details (Priority, Rent, Contact, Notes)'}
          </button>

          {showAdvanced && (
            <div className="row g-3 mt-1 p-3 bg-light rounded border">
              {/* Priority & Rent */}
              <div className="col-sm-6">
                <label className="form-label small fw-semibold">Visit Priority</label>
                <select
                  name="priority"
                  className="form-select form-select-sm"
                  value={formData.priority}
                  onChange={handleChange}
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>

              <div className="col-sm-6">
                <label className="form-label small fw-semibold">Rent / Target Budget</label>
                <input
                  type="text"
                  name="rent"
                  className="form-control form-control-sm"
                  placeholder="e.g. ₹25,000 / mo or ₹500/meal"
                  value={formData.rent}
                  onChange={handleChange}
                />
              </div>

              {/* Contact Information */}
              <div className="col-sm-6">
                <label className="form-label small fw-semibold">Contact Person</label>
                <input
                  type="text"
                  name="contactPerson"
                  className="form-control form-control-sm"
                  placeholder="e.g. Manager or Owner"
                  value={formData.contactPerson}
                  onChange={handleChange}
                />
              </div>

              <div className="col-sm-6">
                <label className="form-label small fw-semibold">Contact Phone</label>
                <input
                  type="tel"
                  name="contactPhone"
                  className="form-control form-control-sm"
                  placeholder="e.g. +91 98765 43210"
                  value={formData.contactPhone}
                  onChange={handleChange}
                />
              </div>

              {/* Facilities / Amenities */}
              <div className="col-12">
                <label className="form-label small fw-semibold mb-1">Key Facilities</label>
                <div className="d-flex flex-wrap gap-1">
                  {QUICK_FACILITIES.map((facility) => (
                    <button
                      key={facility}
                      type="button"
                      className={`btn btn-sm py-1 px-2 rounded-pill small ${
                        formData.amenities.includes(facility)
                          ? 'btn-primary'
                          : 'btn-outline-secondary bg-white'
                      }`}
                      style={{ fontSize: '0.78rem' }}
                      onClick={() => handleFacilityToggle(facility)}
                    >
                      <i
                        className={`bi ${
                          formData.amenities.includes(facility)
                            ? 'bi-check2'
                            : 'bi-plus'
                        } me-1`}
                      ></i>
                      {facility}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="col-12">
                <label className="form-label small fw-semibold">Notes / Description</label>
                <textarea
                  name="notes"
                  rows="2"
                  className="form-control form-control-sm"
                  placeholder="e.g. Good road access, peaceful locality, parking available inside gate."
                  value={formData.notes}
                  onChange={handleChange}
                />
              </div>

              {/* Already Visited switch */}
              <div className="col-12">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="modalVisitedSwitch"
                    name="visited"
                    checked={formData.visited}
                    onChange={handleChange}
                  />
                  <label className="form-check-label small fw-semibold text-dark" htmlFor="modalVisitedSwitch">
                    Mark as already visited
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default QuickAddPlaceModal;
