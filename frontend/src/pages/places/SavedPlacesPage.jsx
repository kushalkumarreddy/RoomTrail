import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { propertyService, visitService, inspectionService } from '../../services';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import QuickAddPlaceModal from '../../components/places/QuickAddPlaceModal';
import LocationNotesModal from '../../components/places/LocationNotesModal';
import RoomComparisonModal from '../../components/places/RoomComparisonModal';
import RoomInspectionModal from '../../components/places/RoomInspectionModal';
import GoogleMapsLocationLink from '../../components/common/GoogleMapsLocationLink';
import { getGoogleMapsUrl } from '../../utils/googleMaps';
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

  // Phase 1: Visited Location Notes Modal
  const [notesModalPlace, setNotesModalPlace] = useState(null);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);

  // Phase 2: Saved Room Comparison State
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  // Phase 3: Favourite Rooms Filter Tab ('all' or 'favorites')
  const [activeTab, setActiveTab] = useState('all');

  // Phase 6: Room Inspection Checklist State
  const [inspectionPlace, setInspectionPlace] = useState(null);
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
  const [latestInspectionSummary, setLatestInspectionSummary] = useState(null);
  const [loadingInspectionSummary, setLoadingInspectionSummary] = useState(false);

  // Total Favourite Count
  const favoriteCount = useMemo(() => {
    return places.filter((p) => Boolean(p.isFavorite || p.favorite)).length;
  }, [places]);

  // Phase 3: Toggle Favourite Handler
  const handleToggleFavorite = async (place, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const currentlyFav = Boolean(place.isFavorite || place.favorite);
    const nextStatus = !currentlyFav;

    // Optimistically update local places state
    setPlaces((prev) =>
      prev.map((p) => (p.id === place.id ? { ...p, isFavorite: nextStatus, favorite: nextStatus } : p))
    );
    if (activePlace && activePlace.id === place.id) {
      setActivePlace((prev) => ({ ...prev, isFavorite: nextStatus, favorite: nextStatus }));
    }

    try {
      await propertyService.toggleFavorite(place.id, nextStatus);
      showSuccess(
        nextStatus
          ? `Marked "${place.name}" as Favourite!`
          : `Removed "${place.name}" from Favourites.`
      );
    } catch (err) {
      // Revert optimistic update on error
      setPlaces((prev) =>
        prev.map((p) => (p.id === place.id ? { ...p, isFavorite: currentlyFav, favorite: currentlyFav } : p))
      );
      if (activePlace && activePlace.id === place.id) {
        setActivePlace((prev) => ({ ...prev, isFavorite: currentlyFav, favorite: currentlyFav }));
      }
      showError(err.message || 'Failed to update favourite status.');
    }
  };

  // Phase 7: Interactive Leaflet Map Modal for "View on Map"
  const [mapPlace, setMapPlace] = useState(null);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const placeMapRef = useRef(null);
  const placeLeafletInstance = useRef(null);

  const handleOpenNotes = (place) => {
    setNotesModalPlace(place);
    setIsNotesModalOpen(true);
  };

  const handleNotesSaved = (updatedPlace) => {
    setPlaces((prev) =>
      prev.map((p) => (p.id === updatedPlace.id ? { ...p, notes: updatedPlace.notes } : p))
    );
    if (activePlace && activePlace.id === updatedPlace.id) {
      setActivePlace((prev) => ({ ...prev, notes: updatedPlace.notes }));
    }
  };

  // Phase 6: Inspection handlers
  const handleOpenInspection = (place) => {
    setInspectionPlace(place);
    setIsInspectionModalOpen(true);
  };

  const handleInspectionSaved = (savedInspection) => {
    if (activePlace && activePlace.id === savedInspection.propertyId) {
      inspectionService
        .getLatest(activePlace.id)
        .then((summary) => setLatestInspectionSummary(summary))
        .catch(() => {});
    }
  };

  // Phase 6: Load latest inspection summary for activePlace in details modal
  useEffect(() => {
    if (isDetailsOpen && activePlace?.id) {
      setLoadingInspectionSummary(true);
      inspectionService
        .getLatest(activePlace.id)
        .then((summary) => setLatestInspectionSummary(summary))
        .catch(() => setLatestInspectionSummary(null))
        .finally(() => setLoadingInspectionSummary(false));
    } else {
      setLatestInspectionSummary(null);
    }
  }, [isDetailsOpen, activePlace]);

  const toggleSelectForCompare = (placeId) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(placeId)) {
        return prev.filter((id) => id !== placeId);
      }
      if (prev.length >= 4) {
        showError('A maximum of 4 rooms can be compared at a time.');
        return prev;
      }
      return [...prev, placeId];
    });
  };

  const removeRoomFromCompare = (placeId) => {
    setSelectedForCompare((prev) => prev.filter((id) => id !== placeId));
  };

  const clearComparison = () => {
    setSelectedForCompare([]);
  };

  const openComparisonModal = () => {
    if (selectedForCompare.length < 2) {
      showError('Please select at least 2 rooms to compare.');
      return;
    }
    setIsComparisonOpen(true);
  };

  const selectedPlacesForCompare = places.filter((p) => selectedForCompare.includes(p.id));

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

      const gmapsUrl = getGoogleMapsUrl(mapPlace);
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
          ${gmapsUrl ? `
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #cbd5e1;">
              <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: #dc2626; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                <i class="bi bi-geo-alt-fill"></i> Open in Google Maps &rarr;
              </a>
            </div>
          ` : ''}
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

        const matchesTab =
          activeTab === 'all' ||
          (activeTab === 'favorites' && Boolean(place.isFavorite || place.favorite));

        return matchesTab && matchesSearch && matchesCategory && matchesStatus && matchesPriority;
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
  }, [places, searchTerm, selectedCategory, selectedStatus, selectedPriority, sortBy, activeTab]);

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

      {/* Phase 3: Navigation / Filter Tabs (All Rooms vs Favourite Rooms) */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 border-bottom pb-2">
        <ul className="nav nav-pills" id="saved-rooms-tabs" role="tablist">
          <li className="nav-item me-2" role="presentation">
            <button
              type="button"
              className={`nav-link btn-sm ${activeTab === 'all' ? 'active' : 'bg-light text-secondary border'}`}
              onClick={() => setActiveTab('all')}
              id="all-rooms-tab-btn"
            >
              <i className="bi bi-door-open me-1"></i> All Saved Rooms
              <span className="badge bg-secondary ms-1">{places.length}</span>
            </button>
          </li>
          <li className="nav-item" role="presentation">
            <button
              type="button"
              className={`nav-link btn-sm ${activeTab === 'favorites' ? 'active text-white' : 'bg-light text-secondary border'}`}
              style={activeTab === 'favorites' ? { backgroundColor: '#dc3545', borderColor: '#dc3545' } : {}}
              onClick={() => setActiveTab('favorites')}
              id="favourite-rooms-tab-btn"
            >
              <i className={`bi bi-heart-fill me-1 ${activeTab === 'favorites' ? 'text-white' : 'text-danger'}`}></i> Favourite Rooms
              <span className={`badge ms-1 ${activeTab === 'favorites' ? 'bg-white text-danger' : 'bg-danger text-white'}`}>
                {favoriteCount}
              </span>
            </button>
          </li>
        </ul>
        <div className="text-muted small">
          {activeTab === 'favorites' ? (
            <span>Showing <strong>{filteredPlaces.length}</strong> of <strong>{favoriteCount}</strong> favourite room{favoriteCount === 1 ? '' : 's'}</span>
          ) : (
            <span>Total <strong>{places.length}</strong> saved room{places.length === 1 ? '' : 's'}</span>
          )}
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
        activeTab === 'favorites' && favoriteCount === 0 ? (
          <EmptyState
            icon="bi-heart"
            title="No Favourite Rooms Yet"
            description="You haven't marked any rooms as favourite yet. Click the heart icon on any saved room card or table row to keep it here for quick access."
            actionLabel="Browse All Rooms"
            actionIcon="bi-door-open"
            onAction={() => setActiveTab('all')}
          />
        ) : places.length === 0 ? (
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
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className={`place-category-pill ${getCategoryPillClass(place.category)}`}>
                          <i className={`bi ${getCategoryIcon(place.category)}`}></i>
                          {place.category || 'Room'}
                        </span>
                        <div className="form-check form-check-inline mb-0 ms-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`compare-check-${place.id}`}
                            checked={selectedForCompare.includes(place.id)}
                            onChange={() => toggleSelectForCompare(place.id)}
                          />
                          <label
                            className="form-check-label small fw-semibold text-secondary"
                            htmlFor={`compare-check-${place.id}`}
                            style={{ cursor: 'pointer', fontSize: '0.78rem' }}
                          >
                            Compare
                          </label>
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-link p-0 text-decoration-none"
                          onClick={(e) => handleToggleFavorite(place, e)}
                          id={`card-fav-btn-${place.id}`}
                          title={(place.isFavorite || place.favorite) ? 'Remove from favourites' : 'Mark as favourite'}
                          aria-label={(place.isFavorite || place.favorite) ? 'Remove from favourites' : 'Mark as favourite'}
                          style={{ fontSize: '1.25rem', lineHeight: 1 }}
                        >
                          <i className={`bi ${(place.isFavorite || place.favorite) ? 'bi-heart-fill text-danger' : 'bi-heart text-secondary'}`}></i>
                        </button>
                        <span className="badge bg-light text-secondary border small">
                          <i className="bi bi-eye-fill me-1 text-primary"></i>
                          {visitCount} {visitCount === 1 ? 'visit' : 'visits'}
                        </span>
                      </div>
                    </div>

                    <h5 className="fw-bold text-dark mb-1 text-truncate" title={place.name}>
                      {place.name}
                    </h5>

                    <div className="mb-2 text-truncate" style={{ fontSize: '0.84rem' }}>
                      <GoogleMapsLocationLink
                        place={place}
                        onMissingLocation={() => showError('Location coordinates and address are not available for this room.')}
                      />
                    </div>

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

                    {/* Personal Notes Box (View / Edit) */}
                    <div className="p-2 rounded bg-light border small mb-2">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <span className="fw-semibold text-secondary" style={{ fontSize: '0.72rem' }}>
                          <i className="bi bi-sticky-fill text-warning me-1"></i>NOTES
                        </span>
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 text-primary text-decoration-none fw-semibold"
                          style={{ fontSize: '0.72rem' }}
                          onClick={() => handleOpenNotes(place)}
                          id={`card-edit-notes-btn-${place.id}`}
                        >
                          {place.notes ? 'Edit Notes' : '+ Add Notes'}
                        </button>
                      </div>
                      {place.notes ? (
                        <div
                          className="text-dark"
                          style={{
                            maxHeight: '75px',
                            overflowY: 'auto',
                            whiteSpace: 'pre-line',
                            lineHeight: '1.4',
                            fontSize: '0.82rem',
                          }}
                          title={place.notes}
                        >
                          {place.notes}
                        </div>
                      ) : (
                        <div className="fst-italic text-secondary" style={{ fontSize: '0.8rem' }}>
                          No personal notes recorded yet.
                        </div>
                      )}
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
                        className={`btn btn-sm ${selectedForCompare.includes(place.id) ? 'btn-primary' : 'btn-outline-primary'} px-2`}
                        onClick={() => toggleSelectForCompare(place.id)}
                        id={`place-compare-toggle-btn-${place.id}`}
                        title={selectedForCompare.includes(place.id) ? 'Remove from comparison' : 'Select for comparison'}
                      >
                        <i className={`bi ${selectedForCompare.includes(place.id) ? 'bi-check-square-fill' : 'bi-arrow-left-right'} me-1`}></i>
                        {selectedForCompare.includes(place.id) ? 'Selected' : 'Compare'}
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-warning btn-sm px-2"
                        onClick={() => handleOpenNotes(place)}
                        id={`place-notes-btn-${place.id}`}
                        title={place.notes ? 'View & Edit Notes' : 'Add Notes'}
                      >
                        <i className="bi bi-sticky me-1"></i> Notes
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-info btn-sm px-2"
                        onClick={() => handleOpenInspection(place)}
                        id={`room-inspect-btn-${place.id}`}
                        title="Room Inspection Checklist"
                      >
                        <i className="bi bi-clipboard2-check me-1"></i> Inspect
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
                <th style={{ width: '45px' }} className="text-center">
                  <i className="bi bi-arrow-left-right" title="Select rooms to compare"></i>
                </th>
                <th style={{ width: '40px' }} className="text-center" title="Favourite status">
                  <i className="bi bi-heart-fill text-danger"></i>
                </th>
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
                    <td className="text-center" style={{ width: '45px' }}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedForCompare.includes(place.id)}
                        onChange={() => toggleSelectForCompare(place.id)}
                        id={`table-compare-check-${place.id}`}
                        title="Select for comparison"
                      />
                    </td>
                    <td className="text-center" style={{ width: '40px' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0 text-decoration-none"
                        onClick={(e) => handleToggleFavorite(place, e)}
                        id={`table-fav-btn-${place.id}`}
                        title={(place.isFavorite || place.favorite) ? 'Remove from favourites' : 'Mark as favourite'}
                        aria-label={(place.isFavorite || place.favorite) ? 'Remove from favourites' : 'Mark as favourite'}
                        style={{ fontSize: '1.15rem', lineHeight: 1 }}
                      >
                        <i className={`bi ${(place.isFavorite || place.favorite) ? 'bi-heart-fill text-danger' : 'bi-heart text-secondary'}`}></i>
                      </button>
                    </td>
                    <td>
                      <div className="fw-bold text-dark">{place.name}</div>
                      <span className={`place-category-pill ${getCategoryPillClass(place.category)} mt-1`}>
                        <i className={`bi ${getCategoryIcon(place.category)}`}></i>
                        {place.category || 'Room'}
                      </span>
                    </td>
                    <td>
                      <GoogleMapsLocationLink
                        place={place}
                        onMissingLocation={() => showError('Location coordinates and address are not available for this room.')}
                      >
                        <div className="d-inline-block text-truncate" style={{ maxWidth: '220px' }}>
                          <div className="small text-dark fw-medium text-truncate">{place.address || 'Address not set'}</div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>{place.city || ''}</div>
                        </div>
                      </GoogleMapsLocationLink>
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
                    <td style={{ maxWidth: '240px' }}>
                      {place.notes ? (
                        <div className="d-flex align-items-start justify-content-between gap-1">
                          <div
                            className="text-truncate small text-dark"
                            style={{ maxWidth: '180px' }}
                            title={place.notes}
                          >
                            {place.notes}
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-0 text-primary text-decoration-none"
                            onClick={() => handleOpenNotes(place)}
                            title="Edit Notes"
                            id={`table-edit-notes-link-${place.id}`}
                          >
                            <i className="bi bi-pencil-square"></i>
                          </button>
                        </div>
                      ) : (
                        <div className="d-flex align-items-center justify-content-between">
                          <span className="text-muted fst-italic small">No notes</span>
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-0 text-primary small text-decoration-none"
                            onClick={() => handleOpenNotes(place)}
                            id={`table-add-notes-link-${place.id}`}
                          >
                            + Add
                          </button>
                        </div>
                      )}
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
                          className={`btn btn-sm ${(place.isFavorite || place.favorite) ? 'btn-danger' : 'btn-outline-danger'} p-1 px-2`}
                          onClick={(e) => handleToggleFavorite(place, e)}
                          id={`table-fav-action-btn-${place.id}`}
                          title={(place.isFavorite || place.favorite) ? 'Remove from favourites' : 'Mark as favourite'}
                        >
                          <i className={`bi ${(place.isFavorite || place.favorite) ? 'bi-heart-fill' : 'bi-heart'}`}></i>
                        </button>
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
                          className={`btn btn-sm ${selectedForCompare.includes(place.id) ? 'btn-primary' : 'btn-outline-primary'} p-1 px-2`}
                          onClick={() => toggleSelectForCompare(place.id)}
                          id={`table-compare-btn-${place.id}`}
                          title={selectedForCompare.includes(place.id) ? 'Remove from comparison' : 'Compare room'}
                        >
                          <i className="bi bi-arrow-left-right"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-warning p-1 px-2"
                          onClick={() => handleOpenNotes(place)}
                          id={`table-notes-btn-${place.id}`}
                          title="View / Edit Personal Notes"
                        >
                          <i className="bi bi-sticky"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-info p-1 px-2"
                          onClick={() => handleOpenInspection(place)}
                          id={`table-inspect-btn-${place.id}`}
                          title="Room Inspection Checklist"
                        >
                          <i className="bi bi-clipboard2-check"></i>
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
                    className="btn btn-sm btn-outline-info"
                    onClick={() => {
                      setIsDetailsOpen(false);
                      handleOpenInspection(activePlace);
                    }}
                    id="details-inspection-btn"
                  >
                    <i className="bi bi-clipboard2-check me-1"></i> Inspection Checklist
                  </button>
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
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className={`btn btn-sm ${(activePlace.isFavorite || activePlace.favorite) ? 'btn-danger' : 'btn-outline-danger'} d-flex align-items-center gap-1`}
                  onClick={(e) => handleToggleFavorite(activePlace, e)}
                  id="details-fav-btn"
                  title={(activePlace.isFavorite || activePlace.favorite) ? 'Remove from favourites' : 'Mark as favourite'}
                >
                  <i className={`bi ${(activePlace.isFavorite || activePlace.favorite) ? 'bi-heart-fill' : 'bi-heart'}`}></i>
                  {(activePlace.isFavorite || activePlace.favorite) ? 'Favourited' : 'Add to Favourites'}
                </button>
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
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="fw-bold small text-muted text-uppercase mb-0">Address & Location</label>
                <GoogleMapsLocationLink
                  place={activePlace}
                  variant="button"
                  btnSize="sm"
                  onMissingLocation={() => showError('Location coordinates and address are not available for this room.')}
                >
                  Open in Google Maps
                </GoogleMapsLocationLink>
              </div>
              <div className="p-3 rounded bg-light border">
                <GoogleMapsLocationLink
                  place={activePlace}
                  onMissingLocation={() => showError('Location coordinates and address are not available for this room.')}
                >
                  <div className="text-dark fw-medium fs-6">{activePlace.address || 'Address not specified'}</div>
                  {activePlace.city && <div className="text-muted small">{activePlace.city}</div>}
                </GoogleMapsLocationLink>
                {activePlace.latitude && activePlace.longitude && (
                  <div className="small text-primary mt-2 font-monospace d-flex align-items-center justify-content-between flex-wrap gap-2 pt-2 border-top">
                    <span>
                      <i className="bi bi-geo-alt-fill text-danger me-1"></i>
                      GPS Coordinates: {Number(activePlace.latitude).toFixed(6)}°, {Number(activePlace.longitude).toFixed(6)}°
                    </span>
                    <GoogleMapsLocationLink
                      place={activePlace}
                      variant="badge"
                    >
                      Navigate in Google Maps
                    </GoogleMapsLocationLink>
                  </div>
                )}
              </div>
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
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="fw-bold small text-muted text-uppercase mb-0">Personal Notes & Observations</label>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary py-0 px-2"
                  onClick={() => {
                    setIsDetailsOpen(false);
                    handleOpenNotes(activePlace);
                  }}
                  id="details-edit-notes-btn"
                >
                  <i className="bi bi-pencil me-1"></i> {activePlace.notes ? 'Edit Notes' : 'Add Notes'}
                </button>
              </div>
              {activePlace.notes ? (
                <p className="text-dark small bg-light p-3 rounded border mb-0" style={{ whiteSpace: 'pre-line' }}>
                  {activePlace.notes}
                </p>
              ) : (
                <div className="text-muted fst-italic p-3 bg-light rounded border text-center">
                  <i className="bi bi-sticky text-secondary d-block fs-4 mb-1"></i>
                  No personal notes recorded yet. (Optional)
                  <div className="mt-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setIsDetailsOpen(false);
                        handleOpenNotes(activePlace);
                      }}
                      id="details-empty-add-notes-btn"
                    >
                      <i className="bi bi-plus-circle me-1"></i> Add Notes
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Phase 6: Room Inspection Checklist Summary Section */}
            <div className="mt-3 p-3 rounded border" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }} id="details-inspection-section">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-success text-white">
                    <i className="bi bi-clipboard2-check-fill me-1"></i> Inspection
                  </span>
                  <span className="fw-bold small text-dark">ROOM INSPECTION CHECKLIST</span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success fw-semibold"
                  onClick={() => {
                    setIsDetailsOpen(false);
                    handleOpenInspection(activePlace);
                  }}
                  id="details-open-inspection-btn"
                >
                  <i className="bi bi-pencil-square me-1"></i>
                  {latestInspectionSummary ? 'View / Edit Checklist' : 'Start Inspection'}
                </button>
              </div>

              {loadingInspectionSummary ? (
                <div className="text-center py-2 text-muted small">
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Loading inspection summary...
                </div>
              ) : latestInspectionSummary ? (
                <div>
                  <div className="row g-2 mb-2">
                    <div className="col-sm-4">
                      <div className="bg-white p-2 rounded border small">
                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>INSPECTION DATE</div>
                        <div className="fw-bold text-dark">{latestInspectionSummary.inspectionDate || 'Not set'}</div>
                      </div>
                    </div>
                    <div className="col-sm-4">
                      <div className="bg-white p-2 rounded border small">
                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>OVERALL RATING</div>
                        <div className="fw-bold text-warning">
                          {latestInspectionSummary.overallRating ? (
                            <>
                              {Array.from({ length: 5 }, (_, i) => (
                                <i
                                  key={i}
                                  className={`bi ${i < latestInspectionSummary.overallRating ? 'bi-star-fill text-warning' : 'bi-star text-muted'}`}
                                />
                              ))}
                              <span className="ms-1 text-dark">({latestInspectionSummary.overallRating}/5)</span>
                            </>
                          ) : (
                            <span className="text-muted fst-italic">Not rated</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="col-sm-4">
                      <div className="bg-white p-2 rounded border small">
                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>SUITABILITY</div>
                        <div>
                          {latestInspectionSummary.suitableForRent === true ? (
                            <span className="badge bg-success-subtle text-success border border-success-subtle">
                              <i className="bi bi-hand-thumbs-up-fill me-1"></i> Suitable for Rent
                            </span>
                          ) : latestInspectionSummary.suitableForRent === false ? (
                            <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                              <i className="bi bi-hand-thumbs-down-fill me-1"></i> Not Suitable
                            </span>
                          ) : (
                            <span className="badge bg-secondary-subtle text-secondary border">Undecided</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex align-items-center justify-content-between bg-white p-2 rounded border small mb-2">
                    <span className="text-muted">Items Inspected:</span>
                    <span className="fw-bold text-dark">
                      {latestInspectionSummary.inspectedCount || 0} / {latestInspectionSummary.totalItems || 34} checked ({latestInspectionSummary.completionPercentage || 0}%)
                    </span>
                  </div>

                  {(latestInspectionSummary.remarksSnippet || latestInspectionSummary.concernsSnippet) && (
                    <div className="bg-white p-2 rounded border small">
                      {latestInspectionSummary.concernsSnippet && (
                        <div className="text-danger mb-1">
                          <strong><i className="bi bi-exclamation-triangle-fill me-1"></i>Concerns:</strong> {latestInspectionSummary.concernsSnippet}
                        </div>
                      )}
                      {latestInspectionSummary.remarksSnippet && (
                        <div className="text-secondary">
                          <strong>Remarks:</strong> {latestInspectionSummary.remarksSnippet}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-muted small fst-italic bg-white p-2 rounded border text-center">
                  No inspection checklist recorded yet for this room. Click "Start Inspection" to evaluate condition, bathroom, electrical, kitchen, security and surroundings.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Visited Location Notes Modal */}
      <LocationNotesModal
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        property={notesModalPlace}
        onNotesSaved={handleNotesSaved}
      />

      {/* Interactive Leaflet Map Modal for "View on Map" */}
      <Modal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        title={mapPlace ? `Location Map: ${mapPlace.name}` : 'Saved Room Map'}
        size="lg"
        footer={
          <div className="d-flex justify-content-between align-items-center w-100 flex-wrap gap-2">
            <span className="small text-muted">
              Default OpenStreetMap Street Tiles &bull; Coordinates: {mapPlace ? `${Number(mapPlace.latitude).toFixed(4)}°, ${Number(mapPlace.longitude).toFixed(4)}°` : ''}
            </span>
            <div className="d-flex gap-2 align-items-center">
              {mapPlace && (
                <GoogleMapsLocationLink
                  place={mapPlace}
                  variant="button"
                  btnSize="sm"
                  onMissingLocation={() => showError('Location coordinates and address are not available for this room.')}
                >
                  Open in Google Maps
                </GoogleMapsLocationLink>
              )}
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setIsMapModalOpen(false)}
                id="close-place-map-modal-btn"
              >
                Close Map
              </button>
            </div>
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

      {/* Phase 2: Floating Sticky Comparison Dock */}
      {selectedForCompare.length > 0 && (
        <div
          id="saved-rooms-comparison-dock"
          className="position-fixed bottom-0 start-50 translate-middle-x mb-4 shadow-lg p-3 bg-white border border-primary-subtle rounded-4 animate__animated animate__fadeInUp"
          style={{ zIndex: 1040, width: '92%', maxWidth: '850px' }}
        >
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-2">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="p-1 px-2 rounded bg-primary text-white">
                <i className="bi bi-arrow-left-right"></i>
              </span>
              <span className="fw-bold small text-dark">
                {selectedForCompare.length} of 4 rooms selected
              </span>
              <div className="d-none d-sm-flex align-items-center gap-1 flex-wrap ms-1">
                {selectedPlacesForCompare.map((p) => (
                  <span
                    key={p.id}
                    className="badge bg-light text-dark border d-inline-flex align-items-center gap-1 py-1 px-2"
                  >
                    <span className="text-truncate" style={{ maxWidth: '110px' }}>
                      {p.name}
                    </span>
                    <button
                      type="button"
                      className="btn-close"
                      style={{ fontSize: '0.55rem' }}
                      onClick={() => removeRoomFromCompare(p.id)}
                      aria-label="Remove"
                    ></button>
                  </span>
                ))}
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={clearComparison}
              >
                Clear All
              </button>
              <button
                type="button"
                id="compare-selected-btn"
                className="btn btn-sm btn-primary fw-semibold px-3 shadow-sm d-flex align-items-center gap-1"
                onClick={openComparisonModal}
                disabled={selectedForCompare.length < 2}
                title={
                  selectedForCompare.length < 2
                    ? 'Select at least 2 rooms to compare'
                    : 'Open side-by-side room comparison'
                }
              >
                <i className="bi bi-layout-three-columns"></i>
                Compare Selected ({selectedForCompare.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 2: Saved Room Comparison Modal */}
      <RoomComparisonModal
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
        selectedIds={selectedForCompare}
        onRemoveRoom={removeRoomFromCompare}
        userReferenceCoords={
          user?.homeLat && user?.homeLng
            ? { lat: user.homeLat, lng: user.homeLng }
            : null
        }
      />

      {/* Phase 6: Room Inspection Checklist Modal */}
      <RoomInspectionModal
        isOpen={isInspectionModalOpen}
        onClose={() => setIsInspectionModalOpen(false)}
        property={inspectionPlace}
        onInspectionSaved={handleInspectionSaved}
      />
    </div>
  );
};

export default SavedPlacesPage;
