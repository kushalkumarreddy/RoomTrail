import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { propertyService, visitService } from '../../services';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import QuickAddPlaceModal from '../../components/places/QuickAddPlaceModal';
import { formatDate, getCategoryIcon } from '../../utils/formatters';

const SavedPlacesPage = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();

  const [places, setPlaces] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'priority', 'name', 'rent'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'

  // Modal & Dialog states
  const [activePlace, setActivePlace] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [placeToDelete, setPlaceToDelete] = useState(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // Phase 7: Interactive Leaflet Map Modal for "View on Map"
  const [mapPlace, setMapPlace] = useState(null);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const placeMapRef = useRef(null);
  const placeLeafletInstance = useRef(null);

  // Fetch places & visits from MySQL
  const loadPlaces = async () => {
    setLoading(true);
    try {
      const [placesData, visitsData] = await Promise.all([
        propertyService.getAll(),
        visitService.getAll().catch(() => []),
      ]);
      const userPlaces = user?.id ? placesData.filter((p) => !p.userId || p.userId === user.id) : placesData;
      setPlaces(userPlaces);
      setVisits(visitsData || []);
    } catch (err) {
      showError(err.message || 'Failed to load saved places.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlaces();
  }, [user]);

  // Calculate total visits for a specific property
  const getPlaceVisitCount = (placeId) => {
    if (!placeId) return 0;
    const count = visits.filter(
      (v) => String(v.propertyId) === String(placeId) || String(v.destinationId) === String(placeId)
    ).length;
    return count;
  };

  // Format detected date and time
  const getDetectedDateTime = (place) => {
    const raw = place.createdAt || place.createdDate || place.timestamp;
    if (!raw) return 'Not recorded';
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return String(raw);
      return d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(raw);
    }
  };

  // Handle Delete Confirmation
  const confirmDelete = async () => {
    if (!placeToDelete) return;
    try {
      await propertyService.delete(placeToDelete.id);
      showSuccess(`"${placeToDelete.name}" has been deleted.`);
      setPlaces((prev) => prev.filter((p) => p.id !== placeToDelete.id));
      setPlaceToDelete(null);
    } catch (err) {
      showError(err.message || 'Failed to delete place.');
    }
  };

  // Toggle Visit Status
  const handleToggleVisit = async (place) => {
    try {
      const updated = await propertyService.update(place.id, {
        visited: !place.visited,
        visitedAt: !place.visited ? new Date().toISOString() : null,
      });
      setPlaces((prev) =>
        prev.map((p) => (p.id === place.id ? { ...p, visited: updated.visited } : p))
      );
      showSuccess(
        updated.visited
          ? `Marked "${place.name}" as Visited!`
          : `Marked "${place.name}" as Pending visit.`
      );
    } catch (err) {
      showError(err.message || 'Failed to update visit status.');
    }
  };

  // Initialize Leaflet Map Modal when opened
  useEffect(() => {
    if (!isMapModalOpen || !mapPlace) return;

    const timer = setTimeout(() => {
      if (!placeMapRef.current) return;

      if (placeLeafletInstance.current) {
        placeLeafletInstance.current.remove();
        placeLeafletInstance.current = null;
      }

      const lat = Number(mapPlace.latitude) || 17.4938;
      const lng = Number(mapPlace.longitude) || 78.3968;

      const map = L.map(placeMapRef.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: true,
      });

      // Standard Default OpenStreetMap street map tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      placeLeafletInstance.current = map;

      const isVisited = Boolean(mapPlace.visited);
      const pinColor = isVisited ? '#10b981' : '#ea580c';

      const customIcon = L.divIcon({
        className: 'custom-leaflet-pin',
        html: `
          <div style="background-color: ${pinColor}; width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.35);">
            <i class="bi bi-geo-alt-fill" style="transform: rotate(45deg); color: #ffffff; font-size: 15px;"></i>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
      marker.bindPopup(`
        <div style="min-width: 190px; font-family: sans-serif; padding: 4px;">
          <strong style="color: #0b192c; font-size: 14px;">${mapPlace.name}</strong><br/>
          <small style="color: #64748b;">${mapPlace.address || 'Address not specified'}</small><br/>
          ${mapPlace.rent ? `<div style="font-weight: bold; color: #0b192c; font-size: 13px; margin-top: 4px;">Rent: ${mapPlace.rent}</div>` : ''}
          ${mapPlace.contactNumber || mapPlace.contactPhone ? `<div style="font-size: 12px; color: #0284c7;"><i class="bi bi-telephone me-1"></i>${mapPlace.contactNumber || mapPlace.contactPhone}</div>` : ''}
          <div style="font-size: 11px; color: #475569; margin-top: 3px;">
            <i class="bi bi-clock me-1"></i>Detected: ${getDetectedDateTime(mapPlace)}
          </div>
          <span style="display: inline-block; margin-top: 6px; padding: 2px 8px; font-size: 11px; border-radius: 4px; background: ${isVisited ? '#d1fae5' : '#ffedd5'}; color: ${isVisited ? '#065f46' : '#9a3412'}; font-weight: 600;">
            ${isVisited ? 'Visited' : 'Pending'} &bull; ${getPlaceVisitCount(mapPlace.id)} visit(s)
          </span>
        </div>
      `).openPopup();
    }, 150);

    return () => {
      clearTimeout(timer);
      if (placeLeafletInstance.current) {
        placeLeafletInstance.current.remove();
        placeLeafletInstance.current = null;
      }
    };
  }, [isMapModalOpen, mapPlace, visits]);

  // Filter & Sort calculation
  const filteredPlaces = useMemo(() => {
    return places
      .filter((place) => {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          !term ||
          place.name?.toLowerCase().includes(term) ||
          place.address?.toLowerCase().includes(term) ||
          place.category?.toLowerCase().includes(term) ||
          place.city?.toLowerCase().includes(term);

        const matchesCategory =
          selectedCategory === 'all' ||
          place.category?.toLowerCase() === selectedCategory.toLowerCase();

        const matchesStatus =
          selectedStatus === 'all' ||
          (selectedStatus === 'visited' && place.visited) ||
          (selectedStatus === 'pending' && !place.visited);

        const matchesPriority =
          selectedPriority === 'all' ||
          place.priority?.toLowerCase() === selectedPriority.toLowerCase();

        return matchesSearch && matchesCategory && matchesStatus && matchesPriority;
      })
      .sort((a, b) => {
        if (sortBy === 'priority') {
          const score = { high: 3, medium: 2, low: 1 };
          return (score[b.priority] || 1) - (score[a.priority] || 1);
        }
        if (sortBy === 'name') {
          return (a.name || '').localeCompare(b.name || '');
        }
        if (sortBy === 'rent') {
          const rentA = parseInt(String(a.rent || '0').replace(/[^0-9]/g, ''), 10) || 0;
          const rentB = parseInt(String(b.rent || '0').replace(/[^0-9]/g, ''), 10) || 0;
          return rentA - rentB;
        }
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [places, searchTerm, selectedCategory, selectedStatus, selectedPriority, sortBy]);

  const getPriorityBadgeClass = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'priority-badge-high';
      case 'medium':
        return 'priority-badge-medium';
      case 'low':
      default:
        return 'priority-badge-low';
    }
  };

  const getCategoryPillClass = (category) => {
    switch (category?.toLowerCase()) {
      case 'pg':
        return 'category-pg';
      case 'flat':
        return 'category-flat';
      case 'room':
        return 'category-room';
      case 'house':
        return 'category-house';
      default:
        return 'category-other';
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Saved Rooms</h2>
          <p className="page-subtitle">
            Every automatically detected and saved location recorded during your room search
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-rt-accent btn-sm d-flex align-items-center gap-1"
            onClick={() => setIsQuickAddOpen(true)}
            id="quick-add-place-btn"
          >
            <i className="bi bi-lightning-charge-fill"></i> Quick Save Room
          </button>
          <Link to="/travel-history-map" className="btn btn-rt-secondary btn-sm" id="view-travel-history-map-btn">
            <i className="bi bi-map"></i> Travel History Map
          </Link>
          <Link to="/rooms/new" className="btn btn-rt-primary btn-sm" id="add-room-btn">
            <i className="bi bi-plus-lg"></i> Add Room
          </Link>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="places-toolbar">
        <div className="row g-2 align-items-center">
          {/* Search Bar */}
          <div className="col-12 col-md-3">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white border-end-0">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Search by name, address, notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                id="saved-rooms-search-input"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="btn btn-outline-secondary border-start-0"
                  onClick={() => setSearchTerm('')}
                >
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>
          </div>

          {/* Category Filter */}
          <div className="col-6 col-md-2">
            <select
              className="form-select form-select-sm"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              id="saved-rooms-category-filter"
            >
              <option value="all">All Categories</option>
              <option value="room">Single Rooms</option>
              <option value="pg">PG / Co-Living</option>
              <option value="flat">Flats / Apartments</option>
              <option value="house">Independent Houses</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Visit Status Filter */}
          <div className="col-6 col-md-2">
            <select
              className="form-select form-select-sm"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              id="saved-rooms-status-filter"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Visit</option>
              <option value="visited">Visited</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="col-6 col-md-2">
            <select
              className="form-select form-select-sm"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          {/* Sorting Dropdown */}
          <div className="col-6 col-md-2">
            <select
              className="form-select form-select-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              title="Sort places"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="priority">Sort: By Priority</option>
              <option value="name">Sort: By Name (A-Z)</option>
              <option value="rent">Sort: By Rent / Budget</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="col-12 col-md-1 d-flex justify-content-end gap-1">
            <div className="btn-group btn-group-sm" role="group">
              <button
                type="button"
                className={`btn ${viewMode === 'grid' ? 'btn-rt-primary' : 'btn-rt-secondary'}`}
                onClick={() => setViewMode('grid')}
                id="saved-rooms-view-grid-btn"
                title="Grid Card View"
              >
                <i className="bi bi-grid-fill"></i>
              </button>
              <button
                type="button"
                className={`btn ${viewMode === 'table' ? 'btn-rt-primary' : 'btn-rt-secondary'}`}
                onClick={() => setViewMode('table')}
                id="saved-rooms-view-table-btn"
                title="Table View"
              >
                <i className="bi bi-table"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Listing View */}
      {loading ? (
        <LoadingSpinner fullPage text="Loading your saved rooms..." />
      ) : filteredPlaces.length === 0 ? (
        places.length === 0 ? (
          <EmptyState
            icon="bi-door-open"
            title="No Saved Rooms Yet"
            description="Start live tracking while searching for rooms. Every 5-minute stop will be automatically saved here without requiring upfront form entry."
            actionLabel="Start Live Tracking"
            actionIcon="bi-broadcast"
            onAction={() => navigate('/live-tracking')}
          />
        ) : (
          <EmptyState
            icon="bi-filter"
            title="No Matching Rooms Found"
            description="No locations match your current search and filter criteria. Try resetting your filters."
            actionLabel="Reset All Filters"
            actionIcon="bi-arrow-counterclockwise"
            onAction={() => {
              setSearchTerm('');
              setSelectedCategory('all');
              setSelectedStatus('all');
              setSelectedPriority('all');
            }}
          />
        )
      ) : viewMode === 'grid' ? (
        /* GRID CARD VIEW */
        <div className="row g-4" id="saved-rooms-grid">
          {filteredPlaces.map((place) => {
            const contact = place.contactNumber || place.contactPhone || 'Not specified';
            const visitCount = getPlaceVisitCount(place.id);
            const detectedTime = getDetectedDateTime(place);

            return (
              <div key={place.id} className="col-md-6 col-xl-4" id={`room-card-${place.id}`}>
                <div className="place-card h-100 d-flex flex-column">
                  <div className={`place-card-banner priority-${place.priority || 'medium'}`} />
                  <div className="place-card-body d-flex flex-column flex-grow-1">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className={`place-category-pill ${getCategoryPillClass(place.category)}`}>
                        <i className={`bi ${getCategoryIcon(place.category)}`}></i>
                        {place.category || 'Room'}
                      </span>
                      <span className="badge bg-light text-secondary border small">
                        <i className="bi bi-eye-fill me-1 text-primary"></i>
                        {visitCount} {visitCount === 1 ? 'visit' : 'visits'}
                      </span>
                    </div>

                    <h5 className="fw-bold text-dark mb-1 text-truncate" title={place.name}>
                      {place.name}
                    </h5>

                    <p className="text-muted small mb-2 text-truncate" title={place.address}>
                      <i className="bi bi-geo-alt text-danger me-1"></i>
                      {place.address || 'Address not specified'}
                      {place.city ? `, ${place.city}` : ''}
                    </p>

                    <div className="d-flex align-items-center justify-content-between mb-2 border-top border-bottom py-2">
                      <div>
                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>MONTHLY RENT</span>
                        <div className="place-price-tag fw-bold text-dark">
                          {place.rent ? (place.rent.startsWith('₹') ? place.rent : `₹${place.rent}`) : 'Optional / Not specified'}
                        </div>
                      </div>
                      <div className="text-end">
                        <span className="text-muted" style={{ fontSize: '0.72rem' }}>STATUS</span>
                        <div>
                          <span className={`badge ${place.visited ? 'badge-rt-success' : 'badge-rt-warning'}`}>
                            <i className={`bi ${place.visited ? 'bi-check-circle-fill' : 'bi-hourglass-split'} me-1`}></i>
                            {place.visited ? 'Visited' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Contact Number */}
                    <div className="small text-muted mb-2 d-flex align-items-center justify-content-between">
                      <span><i className="bi bi-telephone me-1 text-primary"></i> Contact:</span>
                      {contact !== 'Not specified' ? (
                        <a href={`tel:${contact}`} className="fw-semibold text-primary text-decoration-none">
                          {contact}
                        </a>
                      ) : (
                        <span className="text-muted font-italic">Not specified</span>
                      )}
                    </div>

                    {/* Notes Snippet */}
                    <div className="p-2 rounded bg-light border small text-muted mb-2 text-truncate" title={place.notes || place.description || 'No personal notes'}>
                      <i className="bi bi-sticky me-1 text-warning"></i>
                      {place.notes || place.description || <span className="text-muted fst-italic">No personal notes</span>}
                    </div>

                    {/* Detected Date and Time */}
                    <div className="small text-muted mb-3" style={{ fontSize: '0.78rem' }}>
                      <i className="bi bi-calendar-check me-1 text-secondary"></i>
                      Detected: <strong>{detectedTime}</strong>
                    </div>

                    {/* Actions Row */}
                    <div className="d-flex align-items-center gap-1 mt-auto pt-2 border-top">
                      <button
                        type="button"
                        className="btn btn-rt-secondary btn-sm flex-grow-1"
                        onClick={() => {
                          setActivePlace(place);
                          setIsDetailsOpen(true);
                        }}
                        id={`view-place-btn-${place.id}`}
                        title="View Full Details"
                      >
                        <i className="bi bi-eye me-1"></i> View
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm px-2"
                        onClick={() => {
                          setMapPlace(place);
                          setIsMapModalOpen(true);
                        }}
                        id={`place-view-map-btn-${place.id}`}
                        title="View Location on Map"
                      >
                        <i className="bi bi-map me-1"></i> Map
                      </button>

                      <Link
                        to={`/rooms/edit/${place.id}`}
                        className="btn btn-outline-secondary btn-sm px-2"
                        id={`edit-place-btn-${place.id}`}
                        title="Edit Room"
                      >
                        <i className="bi bi-pencil"></i>
                      </Link>

                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm px-2"
                        onClick={() => setPlaceToDelete(place)}
                        id={`delete-place-btn-${place.id}`}
                        title="Delete Room"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="rt-table-container shadow-sm border rounded bg-white" id="saved-rooms-table">
          <table className="rt-table">
            <thead>
              <tr>
                <th>Property Name</th>
                <th>Address</th>
                <th>Rent</th>
                <th>Contact</th>
                <th>Notes</th>
                <th>Detected Date & Time</th>
                <th>Visits</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlaces.map((place) => {
                const contact = place.contactNumber || place.contactPhone || 'Not specified';
                const visitCount = getPlaceVisitCount(place.id);
                const detectedTime = getDetectedDateTime(place);

                return (
                  <tr key={place.id} id={`room-row-${place.id}`}>
                    <td>
                      <div className="fw-bold text-dark">{place.name}</div>
                      <span className={`place-category-pill ${getCategoryPillClass(place.category)} mt-1`}>
                        <i className={`bi ${getCategoryIcon(place.category)}`}></i>
                        {place.category || 'Room'}
                      </span>
                    </td>
                    <td>
                      <div className="small text-dark">{place.address || 'Address not set'}</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{place.city || 'City'}</div>
                    </td>
                    <td>
                      <span className="fw-bold text-dark">
                        {place.rent ? (place.rent.startsWith('₹') ? place.rent : `₹${place.rent}`) : 'Optional'}
                      </span>
                    </td>
                    <td>
                      {contact !== 'Not specified' ? (
                        <a href={`tel:${contact}`} className="text-primary text-decoration-none small fw-semibold">
                          {contact}
                        </a>
                      ) : (
                        <span className="text-muted small">—</span>
                      )}
                    </td>
                    <td style={{ maxWidth: '180px' }}>
                      <div className="text-truncate small text-muted" title={place.notes || place.description}>
                        {place.notes || place.description || '—'}
                      </div>
                    </td>
                    <td>
                      <div className="small text-dark fw-semibold">{detectedTime}</div>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border small px-2 py-1">
                        {visitCount} {visitCount === 1 ? 'visit' : 'visits'}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="d-flex align-items-center justify-content-end gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary p-1 px-2"
                          onClick={() => {
                            setActivePlace(place);
                            setIsDetailsOpen(true);
                          }}
                          id={`table-view-btn-${place.id}`}
                          title="View Details"
                        >
                          <i className="bi bi-eye"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary p-1 px-2"
                          onClick={() => {
                            setMapPlace(place);
                            setIsMapModalOpen(true);
                          }}
                          id={`table-map-btn-${place.id}`}
                          title="View on Map"
                        >
                          <i className="bi bi-map"></i>
                        </button>
                        <Link
                          to={`/rooms/edit/${place.id}`}
                          className="btn btn-sm btn-outline-secondary p-1 px-2"
                          id={`table-edit-btn-${place.id}`}
                          title="Edit Room"
                        >
                          <i className="bi bi-pencil"></i>
                        </Link>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger p-1 px-2"
                          onClick={() => setPlaceToDelete(place)}
                          id={`table-delete-btn-${place.id}`}
                          title="Delete Room"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Place Details Modal */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        title={activePlace?.name || 'Room Details'}
        size="lg"
        footer={
          <div className="d-flex justify-content-between w-100 align-items-center">
            <span className="small text-muted">
              Detected: {getDetectedDateTime(activePlace || {})}
            </span>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-light border"
                onClick={() => setIsDetailsOpen(false)}
              >
                Close
              </button>
              {activePlace && (
                <>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => {
                      setIsDetailsOpen(false);
                      setMapPlace(activePlace);
                      setIsMapModalOpen(true);
                    }}
                  >
                    <i className="bi bi-map me-1"></i> View on Map
                  </button>
                  <Link
                    to={`/rooms/edit/${activePlace.id}`}
                    className="btn btn-sm btn-rt-primary"
                    onClick={() => setIsDetailsOpen(false)}
                  >
                    <i className="bi bi-pencil me-1"></i> Edit Room
                  </Link>
                </>
              )}
            </div>
          </div>
        }
      >
        {activePlace && (
          <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className={`place-category-pill ${getCategoryPillClass(activePlace.category)}`}>
                <i className={`bi ${getCategoryIcon(activePlace.category)}`}></i>
                {activePlace.category || 'Room'}
              </span>
              <div className="d-flex gap-2">
                <span className="badge bg-light text-dark border small">
                  {getPlaceVisitCount(activePlace.id)} Total Visits
                </span>
                <span className={`badge ${activePlace.visited ? 'badge-rt-success' : 'badge-rt-warning'}`}>
                  {activePlace.visited ? 'Visited' : 'Pending Visit'}
                </span>
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-sm-6">
                <div className="p-3 rounded bg-light border">
                  <div className="text-muted small">Monthly Rent / Budget</div>
                  <div className="fs-5 fw-bold text-dark">
                    {activePlace.rent ? (activePlace.rent.startsWith('₹') ? activePlace.rent : `₹${activePlace.rent}`) : 'Optional / Not specified'}
                  </div>
                </div>
              </div>
              <div className="col-sm-6">
                <div className="p-3 rounded bg-light border">
                  <div className="text-muted small">Detection Date & Time</div>
                  <div className="fs-6 fw-bold text-dark">{getDetectedDateTime(activePlace)}</div>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="fw-bold small text-muted text-uppercase">Address & Location</label>
              <div className="text-dark">{activePlace.address || 'Address not specified'}</div>
              <div className="text-muted small">{activePlace.city || ''}</div>
              {activePlace.latitude && activePlace.longitude && (
                <div className="small text-primary mt-1 font-monospace">
                  <i className="bi bi-geo-alt me-1"></i>
                  GPS Coordinates: {Number(activePlace.latitude).toFixed(6)}°, {Number(activePlace.longitude).toFixed(6)}°
                </div>
              )}
            </div>

            <div className="mb-3 p-3 rounded border" style={{ backgroundColor: 'var(--rt-blue-50)' }}>
              <div className="fw-bold small text-dark mb-1">Contact Information</div>
              <div className="small text-secondary">
                Phone Number: {activePlace.contactNumber || activePlace.contactPhone ? (
                  <a href={`tel:${activePlace.contactNumber || activePlace.contactPhone}`} className="fw-semibold text-primary">
                    {activePlace.contactNumber || activePlace.contactPhone}
                  </a>
                ) : (
                  <span className="text-muted fst-italic">Not provided (optional)</span>
                )}
              </div>
            </div>

            <div className="mb-0">
              <label className="fw-bold small text-muted text-uppercase mb-1">Personal Notes & Observations</label>
              <p className="text-secondary small bg-light p-3 rounded border mb-0">
                {activePlace.notes || activePlace.description || <span className="text-muted fst-italic">No personal notes recorded. (Optional)</span>}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Interactive Leaflet Map Modal for "View on Map" */}
      <Modal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        title={mapPlace ? `Location Map: ${mapPlace.name}` : 'Saved Room Map'}
        size="lg"
        footer={
          <div className="d-flex justify-content-between align-items-center w-100">
            <span className="small text-muted">
              Default OpenStreetMap Street Tiles &bull; Coordinates: {mapPlace ? `${Number(mapPlace.latitude).toFixed(4)}°, ${Number(mapPlace.longitude).toFixed(4)}°` : ''}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setIsMapModalOpen(false)}
              id="close-place-map-modal-btn"
            >
              Close Map
            </button>
          </div>
        }
      >
        <div id="saved-room-map-modal">
          <div
            ref={placeMapRef}
            style={{
              height: '420px',
              width: '100%',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              overflow: 'hidden',
            }}
          />
        </div>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(placeToDelete)}
        title="Delete Saved Room"
        message={`Are you sure you want to remove "${placeToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Room"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPlaceToDelete(null)}
      />

      {/* Quick Add Place Modal */}
      <QuickAddPlaceModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={(newPlace) => {
          setPlaces((prev) => [newPlace, ...prev]);
        }}
      />
    </div>
  );
};

export default SavedPlacesPage;
