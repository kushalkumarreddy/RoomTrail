import React from 'react';
import Modal from '../common/Modal';

const DeleteTripConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  trip,
  isDeleting,
}) => {
  if (!trip) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Recorded Trip"
      size="md"
      footer={
        <div className="d-flex justify-content-between align-items-center w-100">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary px-3"
            onClick={onClose}
            disabled={isDeleting}
            id="cancel-delete-trip-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger px-4 fw-semibold"
            onClick={onConfirm}
            disabled={isDeleting}
            id="confirm-delete-trip-btn"
          >
            {isDeleting ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                Deleting Trip...
              </>
            ) : (
              <>
                <i className="bi bi-trash3-fill me-1"></i> Permanently Delete Trip
              </>
            )}
          </button>
        </div>
      }
    >
      <div id="delete-trip-confirm-content">
        <div className="text-center py-2 mb-3">
          <div
            className="rounded-circle bg-danger-subtle text-danger mx-auto d-flex align-items-center justify-content-center mb-3"
            style={{ width: '56px', height: '56px' }}
          >
            <i className="bi bi-exclamation-triangle-fill fs-3"></i>
          </div>
          <h5 className="fw-bold text-dark mb-1">Delete Trip and Location History?</h5>
          <p className="text-muted small mb-0">
            This operation will permanently delete this recorded journey and cannot be undone.
          </p>
        </div>

        {/* Selected Trip Info Card */}
        <div className="card bg-light border p-3 mb-3">
          <div className="fw-bold text-dark fs-6 mb-1">
            {trip.tripName || trip.title || 'Untitled Journey'}
          </div>
          <div className="text-muted small mb-2">
            <i className="bi bi-geo-alt me-1 text-primary"></i>
            {trip.startLocation || 'Start'} &rarr; {trip.endLocation || 'End'}
          </div>
          <div className="row g-2 text-center small">
            <div className="col-4">
              <div className="p-2 bg-white rounded border">
                <span className="text-muted d-block" style={{ fontSize: '10px' }}>Distance</span>
                <strong>{trip.totalDistance || trip.distanceDisplay || '0 km'}</strong>
              </div>
            </div>
            <div className="col-4">
              <div className="p-2 bg-white rounded border">
                <span className="text-muted d-block" style={{ fontSize: '10px' }}>Duration</span>
                <strong>{trip.totalDuration || trip.durationDisplay || '0 mins'}</strong>
              </div>
            </div>
            <div className="col-4">
              <div className="p-2 bg-white rounded border">
                <span className="text-muted d-block" style={{ fontSize: '10px' }}>Stops</span>
                <strong>{trip.destinations?.length || trip.savedLocationsCount || 0} rooms</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="alert alert-danger border-0 small py-2 px-3 mb-3">
          <strong>What will be deleted:</strong>
          <ul className="mb-0 ps-3 mt-1 text-danger">
            <li>Trip overview and metadata record.</li>
            <li>All associated recorded GPS breadcrumb route points.</li>
            <li>Timeline visit stops and notes recorded for this trip.</li>
          </ul>
        </div>

        <div className="alert alert-success border-0 small py-2 px-3 mb-0 d-flex align-items-center gap-2">
          <i className="bi bi-shield-check text-success fs-5 flex-shrink-0"></i>
          <div>
            <strong>Saved Rooms Protected:</strong> Any rooms or properties independently saved in your account will <strong>NOT</strong> be deleted.
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteTripConfirmModal;
