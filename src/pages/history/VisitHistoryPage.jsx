import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { visitService, tripService } from '../../services';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import { formatDateTime, formatDate, formatCoordinates, getCategoryIcon } from '../../utils/formatters';

const VisitHistoryPage = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();

  const [visits, setVisits] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tripFilter, setTripFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'sequence' | 'name'

  // Modals
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [visitToDelete, setVisitToDelete] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [visitsData, tripsData] = await Promise.all([
        visitService.getAll(),
        tripService.getAll().catch(() => []),
      ]);

      const userVisits = user?.id ? visitsData.filter((v) => !v.userId || v.userId === user.id) : visitsData;
      const userTrips = user?.id ? tripsData.filter((t) => !t.userId || t.userId === user.id) : tripsData;

      setVisits(userVisits);
      setTrips(userTrips);
    } catch (err) {
      console.error('Failed to load visit history data', err);
      showError('Failed to load visit history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const confirmDeleteVisit = async () => {
    if (!visitToDelete) return;
    try {
      await visitService.deleteVisit(visitToDelete.id);
      showSuccess('Visit log entry removed.');
      setVisits((prev) => prev.filter((v) => v.id !== visitToDelete.id));
      if (selectedVisit?.id === visitToDelete.id) {
        setSelectedVisit(null);
      }
      setVisitToDelete(null);
    } catch (err) {
      showError('Failed to remove visit log.');
    }
  };

  // Helper to resolve trip name from ID
  const getTripName = (tripId) => {
    if (!tripId) return 'Ad-hoc / Direct Encounter';
    const found = trips.find((t) => t.id === tripId);
    return found?.tripName || found?.title || `Trip #${tripId}`;
  };

  // Filter and sort visits
  const filteredVisits = useMemo(() => {
    return visits
      .filter((v) => {
        // Search filter
        const term = searchTerm.toLowerCase();
        const tripName = getTripName(v.tripId).toLowerCase();
        const matchesSearch =
          !term ||
          v.propertyName?.toLowerCase().includes(term) ||
          v.address?.toLowerCase().includes(term) ||
          v.notes?.toLowerCase().includes(term) ||
          tripName.includes(term);

        // Category filter
        const matchesCategory =
          categoryFilter === 'all' ||
          v.category?.toLowerCase() === categoryFilter.toLowerCase();

        // Trip filter
        const matchesTrip =
          tripFilter === 'all' ||
          v.tripId === tripFilter;

        // Date range filters
        const visitTime = new Date(v.arrivalTime || v.visitedAt || 0).getTime();
        let matchesStart = true;
        let matchesEnd = true;

        if (startDate) {
          const startMs = new Date(startDate).setHours(0, 0, 0, 0);
          matchesStart = visitTime >= startMs;
        }
        if (endDate) {
          const endMs = new Date(endDate).setHours(23, 59, 59, 999);
          matchesEnd = visitTime <= endMs;
        }

        return matchesSearch && matchesCategory && matchesTrip && matchesStart && matchesEnd;
      })
      .sort((a, b) => {
        const timeA = new Date(a.arrivalTime || a.visitedAt || 0).getTime();
        const timeB = new Date(b.arrivalTime || b.visitedAt || 0).getTime();

        if (sortBy === 'oldest') {
          return timeA - timeB;
        }
        if (sortBy === 'sequence') {
          return (b.visitNumber || 1) - (a.visitNumber || 1);
        }
        if (sortBy === 'name') {
          return (a.propertyName || '').localeCompare(b.propertyName || '');
        }
        // Default: newest first
        return timeB - timeA;
      });
  }, [visits, trips, searchTerm, categoryFilter, tripFilter, startDate, endDate, sortBy]);

  // Open historical destination on map
  const handleOpenOnMap = (visit) => {
    const destId = visit.destinationId || visit.propertyId || '';
    const lat = visit.latitude || visit.visitCoordinates?.lat || 12.9716;
    const lng = visit.longitude || visit.visitCoordinates?.lng || 77.5946;
    navigate(`/map-explorer?placeId=${encodeURIComponent(destId)}&lat=${lat}&lng=${lng}`);
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Visit History</h2>
          <p className="page-subtitle">
            Chronological records of confirmed destination visits, timestamps, and notes
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Link to="/travel-history-map" className="btn btn-rt-secondary btn-sm">
            <i className="bi bi-signpost-2"></i> Travel History Map
          </Link>
          <Link to="/live-tracking" className="btn btn-outline-primary btn-sm">
            <i className="bi bi-broadcast"></i> Live Tracking
          </Link>
          <Link to="/places" className="btn btn-rt-primary btn-sm">
            <i className="bi bi-geo-alt"></i> Saved Places
          </Link>
        </div>
      </div>

      {/* Filter and Control Toolbar */}
      <div className="places-toolbar p-3 mb-4 rounded border bg-white shadow-sm">
        <div className="row g-2 align-items-center">
          {/* Search bar */}
          <div className="col-12 col-lg-4">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light border-end-0">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Search by destination, notes, trip, address..."
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

          {/* Category filter */}
          <div className="col-6 col-sm-4 col-lg-2">
            <select
              className="form-select form-select-sm"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by Category"
            >
              <option value="all">All Categories</option>
              <option value="flat">Flats / Apartments</option>
              <option value="pg">PGs & Hostels</option>
              <option value="room">Rooms</option>
              <option value="house">Houses & Villas</option>
              <option value="travel">Travel Spots</option>
            </select>
          </div>

          {/* Trip filter */}
          <div className="col-6 col-sm-4 col-lg-2">
            <select
              className="form-select form-select-sm"
              value={tripFilter}
              onChange={(e) => setTripFilter(e.target.value)}
              aria-label="Filter by Trip"
            >
              <option value="all">All Trips</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tripName || t.title}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="col-6 col-sm-4 col-lg-2">
            <select
              className="form-select form-select-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort visits"
            >
              <option value="newest">Newest Visits First</option>
              <option value="oldest">Oldest Visits First</option>
              <option value="sequence">Sequence # (High to Low)</option>
              <option value="name">Destination (A to Z)</option>
            </select>
          </div>

          {/* Counter badge */}
          <div className="col-6 col-lg-2 text-end">
            <span className="badge rounded-pill bg-light text-secondary border px-3 py-2 small">
              Records: <strong>{filteredVisits.length}</strong> of {visits.length}
            </span>
          </div>

          {/* Date range row */}
          <div className="col-12 border-top pt-2 mt-2">
            <div className="row g-2 align-items-center">
              <div className="col-auto">
                <span className="small text-muted fw-bold">Date Filter:</span>
              </div>
              <div className="col-auto">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-light text-muted">From</span>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="col-auto">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-light text-muted">To</span>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              {(startDate || endDate || searchTerm || categoryFilter !== 'all' || tripFilter !== 'all') && (
                <div className="col-auto">
                  <button
                    type="button"
                    className="btn btn-sm btn-link text-decoration-none text-muted p-0"
                    onClick={() => {
                      setSearchTerm('');
                      setCategoryFilter('all');
                      setTripFilter('all');
                      setStartDate('');
                      setEndDate('');
                      setSortBy('newest');
                    }}
                  >
                    <i className="bi bi-arrow-counterclockwise me-1"></i>Reset Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      {loading ? (
        <LoadingSpinner fullPage text="Loading confirmed visit history..." />
      ) : filteredVisits.length === 0 ? (
        visits.length === 0 ? (
          <EmptyState
            icon="bi-clock-history"
            title="No Visits Recorded Yet"
            description="When you reach saved destinations during live route tracking and confirm your arrival, permanent timestamped visit logs with sequence numbers will appear here."
            actionLabel="Go to Live Radar"
            actionIcon="bi-broadcast"
            onAction={() => navigate('/live-tracking')}
          />
        ) : (
          <EmptyState
            icon="bi-funnel"
            title="No Matching Visits"
            description="No historical visit records match your selected search or date criteria."
            actionLabel="Reset All Filters"
            onAction={() => {
              setSearchTerm('');
              setCategoryFilter('all');
              setTripFilter('all');
              setStartDate('');
              setEndDate('');
            }}
          />
        )
      ) : (
        <div className="rt-table-container shadow-sm border rounded">
          <table className="rt-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Sequence</th>
                <th style={{ width: '160px' }}>Date & Time</th>
                <th>Destination & Category</th>
                <th>Associated Trip</th>
                <th>Visit Notes & Remarks</th>
                <th style={{ width: '140px' }} className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVisits.map((v) => {
                const seqNum = v.visitNumber || (v.isRevisit ? 2 : 1);
                const isRevisitRecord = Boolean(v.isRevisit || seqNum > 1 || v.visitStatus === 'revisited');
                const lat = v.latitude || v.visitCoordinates?.lat;
                const lng = v.longitude || v.visitCoordinates?.lng;

                return (
                  <tr key={v.id}>
                    {/* Sequence Badge */}
                    <td>
                      <span
                        className={`badge ${
                          isRevisitRecord
                            ? 'bg-warning-subtle text-warning-emphasis border border-warning'
                            : 'bg-success-subtle text-success border border-success'
                        } px-2 py-1 small`}
                      >
                        <i className={`bi ${isRevisitRecord ? 'bi-arrow-repeat' : 'bi-check2-circle'} me-1`}></i>
                        Visit #{seqNum}
                        {isRevisitRecord && <span className="d-block" style={{ fontSize: '0.65rem' }}>REVISIT</span>}
                      </span>
                    </td>

                    {/* Date & Arrival/Departure */}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div className="fw-bold text-dark small">
                        {formatDate(v.arrivalTime || v.visitedAt)}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                        <i className="bi bi-clock me-1 text-primary"></i>
                        Arr: {new Date(v.arrivalTime || v.visitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {v.departureTime && (
                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                          <i className="bi bi-box-arrow-right me-1 text-secondary"></i>
                          Dep: {new Date(v.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </td>

                    {/* Destination, Category, GPS */}
                    <td>
                      <div className="fw-bold text-dark fs-6">{v.propertyName || 'Saved Destination'}</div>
                      <div className="text-muted small text-truncate" style={{ maxWidth: '300px' }}>
                        <i className="bi bi-geo-alt me-1 text-danger"></i>
                        {v.address || 'Address on record'}
                      </div>
                      <div className="d-flex align-items-center gap-2 mt-1">
                        <span className="badge-rt badge-rt-primary" style={{ fontSize: '0.68rem' }}>
                          <i className={`bi ${getCategoryIcon(v.category)}`}></i>
                          {v.category || 'Rental'}
                        </span>
                        {lat && lng && (
                          <span className="text-muted font-monospace" style={{ fontSize: '0.7rem' }}>
                            <i className="bi bi-crosshair me-1"></i>
                            {Number(lat).toFixed(4)}°, {Number(lng).toFixed(4)}°
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Associated Trip */}
                    <td>
                      <div className="fw-semibold text-dark small">
                        <i className="bi bi-signpost-split me-1 text-primary"></i>
                        {getTripName(v.tripId)}
                      </div>
                      {v.tripId ? (
                        <span className="badge bg-light text-secondary border font-monospace mt-1" style={{ fontSize: '0.68rem' }}>
                          ID: {v.tripId}
                        </span>
                      ) : (
                        <span className="text-muted small fst-italic">Independent visit</span>
                      )}
                    </td>

                    {/* Visit Notes */}
                    <td>
                      {v.notes ? (
                        <div className="p-2 rounded bg-light border small text-secondary" style={{ maxWidth: '340px' }}>
                          <i className="bi bi-chat-left-text me-1 text-primary"></i>
                          {v.notes}
                        </div>
                      ) : (
                        <span className="text-muted fst-italic small">No remarks logged</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="text-end" style={{ whiteSpace: 'nowrap' }}>
                      <div className="d-inline-flex gap-1">
                        {/* Open Detailed Modal */}
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary p-1 px-2"
                          onClick={() => setSelectedVisit(v)}
                          title="View Visit Details"
                        >
                          <i className="bi bi-eye"></i>
                        </button>

                        {/* Open On Map */}
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary p-1 px-2"
                          onClick={() => handleOpenOnMap(v)}
                          title="Open Historical Destination on Map"
                        >
                          <i className="bi bi-map"></i>
                        </button>

                        {/* Delete Log */}
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger p-1 px-2"
                          onClick={() => setVisitToDelete(v)}
                          title="Remove Visit Entry"
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

      {/* Detailed Visit View Modal (Feature 2 Requirement) */}
      <Modal
        isOpen={Boolean(selectedVisit)}
        onClose={() => setSelectedVisit(null)}
        title="Historical Visit Details"
        size="md"
        footer={
          <div className="d-flex justify-content-between align-items-center w-100 flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setSelectedVisit(null)}
            >
              Close
            </button>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-rt-primary"
                onClick={() => {
                  if (selectedVisit) handleOpenOnMap(selectedVisit);
                }}
              >
                <i className="bi bi-map me-1"></i> Open on Map Explorer
              </button>
              {selectedVisit?.tripId && (
                <button
                  type="button"
                  className="btn btn-sm btn-rt-secondary"
                  onClick={() => {
                    navigate(`/travel-history-map?tripId=${selectedVisit.tripId}`);
                  }}
                >
                  <i className="bi bi-signpost-2 me-1"></i> Travel History Map
                </button>
              )}
            </div>
          </div>
        }
      >
        {selectedVisit && (
          <div>
            <div className="d-flex align-items-center justify-content-between pb-3 mb-3 border-bottom">
              <div>
                <h5 className="fw-bold text-dark mb-1">{selectedVisit.propertyName}</h5>
                <p className="text-muted small mb-0">
                  <i className="bi bi-geo-alt me-1 text-danger"></i>
                  {selectedVisit.address || 'Address on record'}
                </p>
              </div>
              <span className="badge-rt badge-rt-primary text-uppercase">
                <i className={`bi ${getCategoryIcon(selectedVisit.category)}`}></i>
                {selectedVisit.category}
              </span>
            </div>

            <div className="card bg-light border p-3 mb-3">
              <div className="row g-2 small">
                <div className="col-6">
                  <span className="text-muted d-block">Visit Sequence:</span>
                  <span className={`badge ${selectedVisit.isRevisit ? 'bg-warning-subtle text-warning-emphasis border border-warning' : 'bg-success-subtle text-success border border-success'} fs-6 px-2 py-1`}>
                    Visit #{selectedVisit.visitNumber || 1} {selectedVisit.isRevisit ? '(Revisit)' : '(First Visit)'}
                  </span>
                </div>
                <div className="col-6">
                  <span className="text-muted d-block">Encounter Status:</span>
                  <strong className="text-dark text-capitalize">{selectedVisit.visitStatus || 'Confirmed'}</strong>
                </div>
                <div className="col-6 mt-2">
                  <span className="text-muted d-block">Arrival Timestamp:</span>
                  <strong className="text-dark">
                    <i className="bi bi-clock me-1 text-primary"></i>
                    {formatDateTime(selectedVisit.arrivalTime || selectedVisit.visitedAt)}
                  </strong>
                </div>
                <div className="col-6 mt-2">
                  <span className="text-muted d-block">Departure Timestamp:</span>
                  <strong className="text-dark">
                    {selectedVisit.departureTime ? (
                      <><i className="bi bi-box-arrow-right me-1 text-secondary"></i>{formatDateTime(selectedVisit.departureTime)}</>
                    ) : (
                      <span className="text-muted fst-italic">En-route / Not logged</span>
                    )}
                  </strong>
                </div>
                <div className="col-12 mt-2 pt-2 border-top">
                  <span className="text-muted d-block">GPS Coordinates on Arrival:</span>
                  <strong className="text-dark font-monospace">
                    <i className="bi bi-crosshair me-1 text-primary"></i>
                    {formatCoordinates(
                      selectedVisit.latitude || selectedVisit.visitCoordinates?.lat,
                      selectedVisit.longitude || selectedVisit.visitCoordinates?.lng
                    )}
                  </strong>
                </div>
                <div className="col-12 mt-2 pt-2 border-top">
                  <span className="text-muted d-block">Associated Journey / Trip:</span>
                  <strong className="text-dark">
                    <i className="bi bi-signpost-split me-1 text-primary"></i>
                    {getTripName(selectedVisit.tripId)}
                  </strong>
                  {selectedVisit.tripId && (
                    <span className="text-muted font-monospace small ms-2">({selectedVisit.tripId})</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold text-dark">Visit Remarks & Notes</label>
              <div className="p-3 rounded bg-white border text-secondary small">
                {selectedVisit.notes ? (
                  <><i className="bi bi-chat-quote me-2 text-primary"></i>{selectedVisit.notes}</>
                ) : (
                  <span className="fst-italic text-muted">No notes recorded for this visit.</span>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(visitToDelete)}
        title="Remove Visit Log"
        message="Are you sure you want to permanently delete this historical visit log entry? Past visits for other dates will remain intact."
        confirmLabel="Remove Entry"
        confirmVariant="danger"
        onConfirm={confirmDeleteVisit}
        onCancel={() => setVisitToDelete(null)}
      />
    </div>
  );
};

export default VisitHistoryPage;
