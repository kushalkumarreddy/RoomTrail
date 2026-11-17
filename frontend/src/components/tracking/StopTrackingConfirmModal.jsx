import React from 'react';
import Modal from '../common/Modal';

const StopTrackingConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  elapsedDuration,
  distanceCovered,
  pointsCount,
  stopsCount,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="End Trip Recording Session"
      size="md"
      footer={
        <div className="d-flex justify-content-between align-items-center w-100">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary px-3"
            onClick={onClose}
            disabled={isSubmitting}
            id="stop-tracking-keep-btn"
          >
            Keep Tracking
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger px-4 fw-semibold"
            onClick={onConfirm}
            disabled={isSubmitting}
            id="stop-tracking-confirm-btn"
          >
            {isSubmitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                Finalizing Trip...
              </>
            ) : (
              <>
                <i className="bi bi-stop-circle-fill me-1"></i> End Trip & Save
              </>
            )}
          </button>
        </div>
      }
    >
      <div id="stop-tracking-confirm-content">
        <div className="text-center py-2 mb-3">
          <div
            className="rounded-circle bg-danger-subtle text-danger mx-auto d-flex align-items-center justify-content-center mb-3"
            style={{ width: '56px', height: '56px' }}
          >
            <i className="bi bi-stop-fill fs-2"></i>
          </div>
          <h5 className="fw-bold text-dark mb-1">Are you sure you want to stop tracking?</h5>
          <p className="text-muted small mb-0">
            Ending this trip will stop GPS recording and finalize your journey summary.
          </p>
        </div>

        {/* Current Trip Summary Box */}
        <div className="card bg-light border-0 mb-3">
          <div className="card-body p-3">
            <h6 className="fw-bold text-dark mb-2 small text-uppercase tracking-wider">
              Recorded Session Summary
            </h6>
            <div className="row g-2 text-center">
              <div className="col-3">
                <div className="p-2 bg-white rounded border">
                  <div className="text-muted small" style={{ fontSize: '10px' }}>Duration</div>
                  <strong className="text-dark small">{elapsedDuration || '0 mins'}</strong>
                </div>
              </div>
              <div className="col-3">
                <div className="p-2 bg-white rounded border">
                  <div className="text-muted small" style={{ fontSize: '10px' }}>Distance</div>
                  <strong className="text-dark small">{distanceCovered || '0 km'}</strong>
                </div>
              </div>
              <div className="col-3">
                <div className="p-2 bg-white rounded border">
                  <div className="text-muted small" style={{ fontSize: '10px' }}>GPS Points</div>
                  <strong className="text-primary small">{pointsCount || 0}</strong>
                </div>
              </div>
              <div className="col-3">
                <div className="p-2 bg-white rounded border">
                  <div className="text-muted small" style={{ fontSize: '10px' }}>Stops</div>
                  <strong className="text-success small">{stopsCount || 0}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="alert alert-warning border-0 small py-2 px-3 mb-0 d-flex align-items-center gap-2">
          <i className="bi bi-info-circle-fill text-warning fs-5"></i>
          <div>
            All recorded route points and visited room notes will be safely preserved in your <strong>Travel History</strong>.
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default StopTrackingConfirmModal;
