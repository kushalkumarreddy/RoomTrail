import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { propertyService } from '../../services';
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

  // Fetch places
  const loadPlaces = async () => {
    setLoading(true);
    try {
      const data = await propertyService.getAll();
      const userPlaces = user?.id ? data.filter((p) => !p.userId || p.userId === user.id) : data;
      setPlaces(userPlaces);
    } catch (err) {
      showError(err.message || 'Failed to load saved places.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlaces();
  }, [user]);

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

  // Filter & Sort calculation
  const filteredPlaces = useMemo(() => {
    return places
      .filter((place) => {
        // Search term
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          !term ||
          place.name?.toLowerCase().includes(term) ||
          place.address?.toLowerCase().includes(term) ||
          place.category?.toLowerCase().includes(term) ||
          place.city?.toLowerCase().includes(term);

        // Category filter
        const matchesCategory =
          selectedCategory === 'all' ||
          place.category?.toLowerCase() === selectedCategory.toLowerCase();

        // Status filter
        const matchesStatus =
          selectedStatus === 'all' ||
          (selectedStatus === 'visited' && place.visited) ||
          (selectedStatus === 'pending' && !place.visited);

        // Priority filter
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
        // default newest
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
      case 'restaurant':
        return 'category-restaurant';
      case 'shopping':
        return 'category-shopping';
      case 'hospital':
        return 'category-hospital';
      case 'office':
        return 'category-office';
      case 'tourist':
      case 'travel':
        return 'category-tourist';
      default:
        return 'category-other';
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Saved Places & Destinations</h2>
          <p className="page-subtitle">
            Manage your saved rental flats, PGs, rooms, houses, restaurants, and travel spots
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-rt-accent btn-sm d-flex align-items-center gap-1"
            onClick={() => setIsQuickAddOpen(true)}
            id="quick-add-place-btn"
          >
            <i className="bi bi-lightning-charge-fill"></i> Quick Add Destination
          </button>
          <Link to="/map-explorer" className="btn btn-rt-secondary btn-sm">
            <i className="bi bi-map"></i> View on Map
          </Link>
          <Link to="/places/new" className="btn btn-rt-primary btn-sm">
            <i className="bi bi-plus-lg"></i> Add New Place
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
            >
              <option value="all">All Categories</option>
              <option value="flat">Flats / Apartments</option>
              <option value="pg">PG / Co-Living</option>
              <option value="room">Single Rooms</option>
              <option value="house">Independent Houses</option>
              <option value="restaurant">Restaurants / Cafes</option>
              <option value="shopping">Shopping / Malls</option>
              <option value="hospital">Hospitals / Clinics</option>
              <option value="office">Offices / Workplaces</option>
              <option value="tourist">Tourist Places / Landmarks</option>
              <option value="travel">Travel Spots</option>
              <option value="other">Other Categories</option>
            </select>
          </div>

          {/* Visit Status Filter */}
          <div className="col-6 col-md-2">
            <select
              className="form-select form-select-sm"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
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
                title="Grid Card View"
              >
                <i className="bi bi-grid-fill"></i>
              </button>
              <button
                type="button"
                className={`btn ${viewMode === 'table' ? 'btn-rt-primary' : 'btn-rt-secondary'}`}
                onClick={() => setViewMode('table')}
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
        <LoadingSpinner fullPage text="Loading your saved places..." />
      ) : filteredPlaces.length === 0 ? (
        places.length === 0 ? (
          <EmptyState
            icon="bi-pin-map"
            title="No Saved Destinations Yet"
            description="You haven't saved any rental flats, PGs, or travel destinations. Add your first place to organize visits, record coordinates, and prevent duplicate travel."
            actionLabel="Add First Place"
            actionIcon="bi-plus-lg"
            onAction={() => navigate('/places/new')}
          />
        ) : (
          <EmptyState
            icon="bi-filter"
            title="No Matching Places Found"
            description="No destinations match your current search and filter criteria. Try resetting your filters."
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
        <div className="row g-4">
          {filteredPlaces.map((place) => (
            <div key={place.id} className="col-md-6 col-xl-4">
              <div className="place-card">
                <div className={`place-card-banner priority-${place.priority || 'medium'}`} />
                <div className="place-card-body">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <span className={`place-category-pill ${getCategoryPillClass(place.category)}`}>
                      <i className={`bi ${getCategoryIcon(place.category)}`}></i>
                      {place.category || 'Rental'}
                    </span>
                    <span className={`badge ${getPriorityBadgeClass(place.priority)} small`}>
                      {place.priority ? `${place.priority} priority` : 'Normal'}
                    </span>
                  </div>

                  <h5 className="fw-bold text-dark mb-1 text-truncate" title={place.name}>
                    {place.name}
                  </h5>

                  <p className="text-muted small mb-2 text-truncate" title={place.address}>
                    <i className="bi bi-geo-alt text-danger me-1"></i>
                    {place.address || 'Address not specified'}
                  </p>

                  <div className="d-flex align-items-center justify-content-between mb-3 border-top border-bottom py-2">
                    <div>
                      <span className="text-muted" style={{ fontSize: '0.72rem' }}>RENT / BUDGET</span>
                      <div className="place-price-tag">{place.rent || 'Contact for price'}</div>
                    </div>
                    <div className="text-end">
                      <span className="text-muted" style={{ fontSize: '0.72rem' }}>VISIT STATUS</span>
                      <div>
                        <span className={`badge ${place.visited ? 'badge-rt-success' : 'badge-rt-warning'}`}>
                          <i className={`bi ${place.visited ? 'bi-check-circle-fill' : 'bi-hourglass-split'} me-1`}></i>
                          {place.visited ? 'Visited' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {place.contactPhone && (
                    <div className="small text-muted mb-3 d-flex align-items-center justify-content-between">
                      <span><i className="bi bi-telephone me-1"></i> {place.contactPerson || 'Contact'}</span>
                      <a href={`tel:${place.contactPhone}`} className="fw-semibold text-primary text-decoration-none">
                        {place.contactPhone}
                      </a>
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="d-flex align-items-center gap-2 mt-auto pt-2 border-top">
                    <button
                      type="button"
                      className="btn btn-rt-secondary btn-sm flex-grow-1"
                      onClick={() => {
                        setActivePlace(place);
                        setIsDetailsOpen(true);
                      }}
                      title="View Details"
                    >
                      <i className="bi bi-eye"></i> Details
                    </button>

                    <button
                      type="button"
                      className={`btn btn-sm ${
                        place.visited ? 'btn-outline-secondary' : 'btn-outline-success'
                      }`}
                      onClick={() => handleToggleVisit(place)}
                      title={place.visited ? 'Mark as Pending' : 'Mark as Visited'}
                    >
                      <i className={`bi ${place.visited ? 'bi-arrow-counterclockwise' : 'bi-check-lg'}`}></i>
                    </button>

                    <Link
                      to={`/places/edit/${place.id}`}
                      className="btn btn-rt-ghost btn-sm p-1"
                      title="Edit Place"
                    >
                      <i className="bi bi-pencil"></i>
                    </Link>

                    <button
                      type="button"
                      className="btn btn-rt-ghost btn-sm text-danger p-1"
                      onClick={() => setPlaceToDelete(place)}
                      title="Delete Place"
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="rt-table-container">
          <table className="rt-table">
            <thead>
              <tr>
                <th>Place & Category</th>
                <th>Address & City</th>
                <th>Rent / Budget</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlaces.map((place) => (
                <tr key={place.id}>
                  <td>
                    <div className="fw-bold text-dark">{place.name}</div>
                    <span className={`place-category-pill ${getCategoryPillClass(place.category)} mt-1`}>
                      <i className={`bi ${getCategoryIcon(place.category)}`}></i>
                      {place.category || 'Rental'}
                    </span>
                  </td>
                  <td>
                    <div className="small text-dark">{place.address || 'Address not set'}</div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>{place.city || 'City'}</div>
                  </td>
                  <td>
                    <span className="fw-bold text-dark">{place.rent || 'N/A'}</span>
                  </td>
                  <td>
                    <span className={`badge ${getPriorityBadgeClass(place.priority)} small`}>
                      {place.priority || 'Normal'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${place.visited ? 'badge-rt-success' : 'badge-rt-warning'}`}>
                      {place.visited ? 'Visited' : 'Pending'}
                    </span>
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary p-1 px-2"
                        onClick={() => {
                          setActivePlace(place);
                          setIsDetailsOpen(true);
                        }}
                        title="View Details"
                      >
                        <i className="bi bi-eye"></i>
                      </button>
                      <Link
                        to={`/places/edit/${place.id}`}
                        className="btn btn-sm btn-outline-secondary p-1 px-2"
                        title="Edit Place"
                      >
                        <i className="bi bi-pencil"></i>
                      </Link>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger p-1 px-2"
                        onClick={() => setPlaceToDelete(place)}
                        title="Delete Place"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Place Details Modal */}
      <Modal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        title={activePlace?.name || 'Destination Details'}
        size="lg"
        footer={
          <div className="d-flex justify-content-between w-100 align-items-center">
            <span className="small text-muted">
              Added: {formatDate(activePlace?.createdAt)}
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
                <Link
                  to={`/places/edit/${activePlace.id}`}
                  className="btn btn-sm btn-rt-primary"
                  onClick={() => setIsDetailsOpen(false)}
                >
                  <i className="bi bi-pencil me-1"></i> Edit Place
                </Link>
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
                {activePlace.category}
              </span>
              <span className={`badge ${activePlace.visited ? 'badge-rt-success' : 'badge-rt-warning'}`}>
                {activePlace.visited ? 'Visited' : 'Pending Visit'}
              </span>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-sm-6">
                <div className="p-3 rounded bg-light border">
                  <div className="text-muted small">Target Rent / Budget</div>
                  <div className="fs-5 fw-bold text-dark">{activePlace.rent || 'Not specified'}</div>
                </div>
              </div>
              <div className="col-sm-6">
                <div className="p-3 rounded bg-light border">
                  <div className="text-muted small">Priority Level</div>
                  <div className="fs-5 fw-bold text-capitalize">{activePlace.priority || 'Medium'}</div>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="fw-bold small text-muted text-uppercase">Address & Location</label>
              <div className="text-dark">{activePlace.address}</div>
              <div className="text-muted small">{activePlace.city}</div>
              {activePlace.latitude && activePlace.longitude && (
                <div className="small text-primary mt-1">
                  <i className="bi bi-geo-alt me-1"></i>
                  Coordinates: {activePlace.latitude}°, {activePlace.longitude}°
                </div>
              )}
            </div>

            {activePlace.contactPhone && (
              <div className="mb-3 p-3 rounded border" style={{ backgroundColor: 'var(--rt-blue-50)' }}>
                <div className="fw-bold small text-dark mb-1">Contact Information</div>
                <div className="small text-secondary">Person: {activePlace.contactPerson || 'Not provided'}</div>
                <div className="small text-secondary">
                  Phone: <a href={`tel:${activePlace.contactPhone}`} className="fw-semibold text-primary">{activePlace.contactPhone}</a>
                </div>
              </div>
            )}

            {activePlace.amenities && activePlace.amenities.length > 0 && (
              <div className="mb-3">
                <label className="fw-bold small text-muted text-uppercase mb-2">Amenities & Features</label>
                <div className="d-flex flex-wrap gap-1">
                  {activePlace.amenities.map((amenity, idx) => (
                    <span key={idx} className="place-amenity-chip">
                      <i className="bi bi-check me-1 text-success"></i>
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {activePlace.notes && (
              <div className="mb-0">
                <label className="fw-bold small text-muted text-uppercase mb-1">Notes & Observations</label>
                <p className="text-secondary small bg-light p-3 rounded border mb-0">
                  {activePlace.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(placeToDelete)}
        title="Delete Saved Place"
        message={`Are you sure you want to remove "${placeToDelete?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Place"
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
