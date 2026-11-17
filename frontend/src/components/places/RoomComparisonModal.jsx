import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import GoogleMapsLocationLink from '../common/GoogleMapsLocationLink';
import { propertyService } from '../../services';
import LoadingSpinner from '../common/LoadingSpinner';

/**
 * RoomComparisonModal
 * RoomTrail Phase 2: Saved Room Comparison
 * Side-by-side comparison of 2 to 4 selected saved rooms.
 * Strictly presents actual details and displays 'Not provided' when unavailable.
 */
const RoomComparisonModal = ({
  isOpen,
  onClose,
  selectedIds = [],
  onRemoveRoom,
  userReferenceCoords = null,
}) => {
  const [comparisonRooms, setComparisonRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (!isOpen || !selectedIds || selectedIds.length < 2) {
      if (selectedIds.length < 2) {
        setComparisonRooms([]);
      }
      return;
    }

    const fetchComparison = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const refLat = userReferenceCoords?.lat ?? null;
        const refLng = userReferenceCoords?.lng ?? null;
        const data = await propertyService.compare(selectedIds, refLat, refLng);
        setComparisonRooms(data || []);
      } catch (err) {
        console.error('Failed to load comparison data:', err);
        const msg = err.response?.data?.message || err.message || 'Failed to load room comparison.';
        setErrorMsg(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchComparison();
  }, [isOpen, selectedIds, userReferenceCoords]);

  if (!isOpen) return null;

  // Extract numeric rent for difference comparison
  const parseNumericRent = (rentStr) => {
    if (!rentStr || rentStr === 'Not provided') return null;
    const cleaned = String(rentStr).replace(/[^0-9]/g, '');
    const num = parseInt(cleaned, 10);
    return isNaN(num) || num <= 0 ? null : num;
  };

  const validRents = comparisonRooms
    .map((r) => parseNumericRent(r.rent))
    .filter((v) => v !== null);

  const minRent = validRents.length > 1 ? Math.min(...validRents) : null;

  // Find min distance among rooms with valid coordinates
  const validDistances = comparisonRooms
    .map((r) => r.distanceMeters)
    .filter((d) => typeof d === 'number' && !isNaN(d) && d > 0);

  const minDistanceMeters = validDistances.length > 1 ? Math.min(...validDistances) : null;

  const renderBadgeValue = (val, isSuccess = false) => {
    if (!val || val === 'Not provided' || val === 'Not specified') {
      return <span className="badge bg-light text-muted border fw-normal px-2 py-1">Not provided</span>;
    }
    return (
      <span
        className={`badge ${
          isSuccess ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-primary-subtle text-primary border border-primary-subtle'
        } fw-medium px-2 py-1`}
      >
        {val}
      </span>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="d-flex align-items-center gap-2">
          <span className="p-1 px-2 rounded bg-primary-subtle text-primary">
            <i className="bi bi-layout-three-columns"></i>
          </span>
          <div>
            <div className="h6 fw-bold mb-0">Saved Room Comparison</div>
            <div className="small text-muted" style={{ fontSize: '0.75rem' }}>
              Side-by-side evaluation to decide which room is most suitable for renting
            </div>
          </div>
        </div>
      }
      size="xl"
      footer={
        <div className="d-flex justify-content-between align-items-center w-100">
          <span className="small text-secondary">
            {comparisonRooms.length >= 2 ? (
              <>
                Comparing <strong className="text-dark">{comparisonRooms.length}</strong> of 4 rooms
              </>
            ) : (
              'At least 2 rooms required'
            )}
          </span>
          <button
            type="button"
            id="close-comparison-modal-btn"
            className="btn btn-sm btn-outline-secondary px-3"
            onClick={onClose}
          >
            <i className="bi bi-arrow-left me-1"></i> Back to Saved Rooms
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="py-5 text-center">
          <LoadingSpinner text="Loading side-by-side comparison..." />
        </div>
      ) : errorMsg ? (
        <div className="alert alert-danger py-3 px-3 my-3">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-exclamation-triangle-fill fs-5"></i>
            <div>
              <div className="fw-semibold">Comparison Request Failed</div>
              <div className="small">{errorMsg}</div>
            </div>
          </div>
        </div>
      ) : comparisonRooms.length < 2 ? (
        <div className="text-center py-5">
          <i className="bi bi-layout-three-columns text-secondary d-block fs-1 mb-2"></i>
          <h6 className="fw-bold text-dark">Need At Least Two Rooms</h6>
          <p className="text-muted small mb-3">
            Please select at least 2 rooms from your saved listings to perform a side-by-side comparison.
          </p>
          <button className="btn btn-sm btn-primary" onClick={onClose}>
            Back to Saved Rooms
          </button>
        </div>
      ) : (
        <div className="table-responsive border rounded bg-white shadow-sm" style={{ maxHeight: '72vh' }}>
          <table className="table table-bordered align-middle mb-0" id="room-comparison-table">
            {/* Header row with Room Names & Remove Action */}
            <thead className="table-light sticky-top" style={{ zIndex: 10 }}>
              <tr>
                <th
                  className="bg-light fw-bold text-uppercase small text-muted ps-3 py-3"
                  style={{ width: '220px', minWidth: '180px', verticalAlign: 'top' }}
                >
                  <div className="text-secondary small fw-bold">FEATURES & ATTRIBUTES</div>
                  <div className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'none' }}>
                    Comparing {comparisonRooms.length} selected rooms
                  </div>
                </th>
                {comparisonRooms.map((room) => (
                  <th
                    key={room.id}
                    className="bg-white p-3 text-center"
                    style={{ minWidth: '220px', verticalAlign: 'top' }}
                  >
                    <div className="d-flex flex-column align-items-center">
                      <div className="d-flex align-items-center gap-1 mb-1">
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-0" style={{ fontSize: '0.7rem' }}>
                          {room.category || 'ROOM'}
                        </span>
                        {(room.isFavorite || room.favorite) && (
                          <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-1 py-0" style={{ fontSize: '0.7rem' }}>
                            <i className="bi bi-heart-fill me-1"></i>Favourite
                          </span>
                        )}
                      </div>
                      <h6 className="fw-bold text-dark mb-1 text-truncate w-100" title={room.name}>
                        {room.name}
                      </h6>
                      <div className="small text-muted text-truncate w-100 mb-2" style={{ fontSize: '0.75rem' }} title={room.address}>
                        <GoogleMapsLocationLink
                          place={room}
                          showExternalIcon={false}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger py-0 px-2 small"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => onRemoveRoom(room.id)}
                        id={`comparison-remove-btn-${room.id}`}
                        title="Remove this room from comparison"
                      >
                        <i className="bi bi-x-circle me-1"></i> Remove
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="small">
              {/* Monthly Rent */}
              <tr>
                <th className="bg-light-subtle ps-3 py-2 fw-semibold text-secondary">
                  <i className="bi bi-currency-rupee me-1 text-dark"></i> Monthly Rent
                </th>
                {comparisonRooms.map((room) => {
                  const numRent = parseNumericRent(room.rent);
                  const isLowest = minRent !== null && numRent === minRent;
                  const displayRent = room.rent && room.rent !== 'Not provided' ? (room.rent.startsWith('₹') ? room.rent : `₹${room.rent}`) : 'Not provided';
                  return (
                    <td key={room.id} className="p-3 text-center">
                      <div className="fw-bold fs-6 text-dark">{displayRent}</div>
                      {isLowest && (
                        <span className="badge bg-success-subtle text-success border border-success-subtle mt-1" style={{ fontSize: '0.7rem' }}>
                          <i className="bi bi-tag-fill me-1"></i> Lowest Rent
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Property Type */}
              <tr>
                <th className="bg-light-subtle ps-3 py-2 fw-semibold text-secondary">
                  <i className="bi bi-building me-1 text-dark"></i> Property Type
                </th>
                {comparisonRooms.map((room) => (
                  <td key={room.id} className="p-3 text-center">
                    <span className="badge bg-light text-dark border px-2 py-1 font-monospace">
                      {room.category || 'Not provided'}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Distance from Reference Location */}
              <tr>
                <th className="bg-light-subtle ps-3 py-2 fw-semibold text-secondary">
                  <i className="bi bi-signpost-2 me-1 text-primary"></i> Distance to Reference
                </th>
                {comparisonRooms.map((room) => {
                  const isNearest = minDistanceMeters !== null && room.distanceMeters === minDistanceMeters;
                  return (
                    <td key={room.id} className="p-3 text-center">
                      <div className="fw-medium text-dark">
                        {room.distance && room.distance !== 'Not provided' ? (
                          <>
                            <i className="bi bi-geo me-1 text-primary"></i>
                            {room.distance}
                          </>
                        ) : (
                          <span className="badge bg-light text-muted border fw-normal px-2 py-1">Not provided</span>
                        )}
                      </div>
                      {isNearest && (
                        <span className="badge bg-info-subtle text-info border border-info-subtle mt-1" style={{ fontSize: '0.7rem' }}>
                          <i className="bi bi-compass me-1"></i> Nearest
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Address or Locality */}
              <tr>
                <th className="bg-light-subtle ps-3 py-2 fw-semibold text-secondary">
                  <i className="bi bi-geo-alt me-1 text-danger"></i> Locality / Address
                </th>
                {comparisonRooms.map((room) => (
                  <td key={room.id} className="p-3 text-center">
                    <div className="text-secondary small" style={{ lineHeight: '1.4' }}>
                      {room.address && room.address !== 'Not provided' ? (
                        <GoogleMapsLocationLink
                          place={room}
                        >
                          <span className="fw-medium">
                            {room.address}
                            {room.city ? `, ${room.city}` : ''}
                          </span>
                        </GoogleMapsLocationLink>
                      ) : (
                        <span className="badge bg-light text-muted border fw-normal px-2 py-1">Not provided</span>
                      )}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Drinking Water Availability */}
              <tr>
                <th className="bg-light-subtle ps-3 py-2 fw-semibold text-secondary">
                  <i className="bi bi-droplet me-1 text-info"></i> Drinking Water
                </th>
                {comparisonRooms.map((room) => (
                  <td key={room.id} className="p-3 text-center">
                    {renderBadgeValue(room.water, room.water === 'Available')}
                  </td>
                ))}
              </tr>

              {/* Parking Facility */}
              <tr>
                <th className="bg-light-subtle ps-3 py-2 fw-semibold text-secondary">
                  <i className="bi bi-p-square me-1 text-primary"></i> Parking Availability
                </th>
                {comparisonRooms.map((room) => (
                  <td key={room.id} className="p-3 text-center">
                    {renderBadgeValue(room.parking, room.parking === 'Available')}
                  </td>
                ))}
              </tr>

              {/* Wi-Fi Availability */}
              <tr>
                <th className="bg-light-subtle ps-3 py-2 fw-semibold text-secondary">
                  <i className="bi bi-wifi me-1 text-success"></i> Wi-Fi Availability
                </th>
                {comparisonRooms.map((room) => (
                  <td key={room.id} className="p-3 text-center">
                    {renderBadgeValue(room.wifi, room.wifi === 'Available')}
                  </td>
                ))}
              </tr>

              {/* Bathroom Availability */}
              <tr>
                <th className="bg-light-subtle ps-3 py-2 fw-semibold text-secondary">
                  <i className="bi bi-door-closed me-1 text-secondary"></i> Bathroom Type
                </th>
                {comparisonRooms.map((room) => (
                  <td key={room.id} className="p-3 text-center">
                    {renderBadgeValue(room.bathroom, room.bathroom === 'Available')}
                  </td>
                ))}
              </tr>

              {/* Ventilation / Balcony */}
              <tr>
                <th className="bg-light-subtle ps-3 py-2 fw-semibold text-secondary">
                  <i className="bi bi-wind me-1 text-primary"></i> Ventilation
                </th>
                {comparisonRooms.map((room) => (
                  <td key={room.id} className="p-3 text-center">
                    {renderBadgeValue(room.ventilation, room.ventilation === 'Available')}
                  </td>
                ))}
              </tr>

              {/* Security & Gated */}
              <tr>
                <th className="bg-light-subtle ps-3 py-2 fw-semibold text-secondary">
                  <i className="bi bi-shield-check me-1 text-warning"></i> Security
                </th>
                {comparisonRooms.map((room) => (
                  <td key={room.id} className="p-3 text-center">
                    {renderBadgeValue(room.security, room.security === 'Available')}
                  </td>
                ))}
              </tr>

              {/* Personal Rating / Priority */}
              <tr>
                <th className="bg-light-subtle ps-3 py-2 fw-semibold text-secondary">
                  <i className="bi bi-star me-1 text-warning"></i> Personal Rating
                </th>
                {comparisonRooms.map((room) => (
                  <td key={room.id} className="p-3 text-center">
                    {renderBadgeValue(room.rating, false)}
                  </td>
                ))}
              </tr>

              {/* Personal Notes (Owner Only) */}
              <tr>
                <th className="bg-light-subtle ps-3 py-2 fw-semibold text-secondary align-top">
                  <i className="bi bi-sticky me-1 text-warning"></i> Personal Notes
                  <div className="text-muted fw-normal" style={{ fontSize: '0.7rem' }}>
                    Visible only to you
                  </div>
                </th>
                {comparisonRooms.map((room) => (
                  <td key={room.id} className="p-3 text-start align-top">
                    {room.notes && room.notes !== 'Not provided' ? (
                      <div
                        className="p-2 rounded bg-light border small text-dark"
                        style={{ maxHeight: '120px', overflowY: 'auto', whiteSpace: 'pre-line', fontSize: '0.82rem' }}
                      >
                        {room.notes}
                      </div>
                    ) : (
                      <div className="text-center">
                        <span className="badge bg-light text-muted border fw-normal px-2 py-1">Not provided</span>
                      </div>
                    )}
                  </td>
                ))}
              </tr>

              {/* Visit Status */}
              <tr>
                <th className="bg-light-subtle ps-3 py-2 fw-semibold text-secondary">
                  <i className="bi bi-clock-history me-1 text-secondary"></i> Visit History
                </th>
                {comparisonRooms.map((room) => (
                  <td key={room.id} className="p-3 text-center">
                    <span className={`badge ${room.visited ? 'badge-rt-success' : 'badge-rt-warning'}`}>
                      <i className={`bi ${room.visited ? 'bi-check-circle-fill' : 'bi-hourglass-split'} me-1`}></i>
                      {room.visited ? 'Visited' : 'Pending Visit'}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
};

export default RoomComparisonModal;
