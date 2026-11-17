import React, { useState } from 'react';
import Modal from '../common/Modal';

const StartTrackingConfirmModal = ({ isOpen, onClose, onConfirm, onDisableFuturePrompt }) => {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const handleStart = () => {
    if (dontAskAgain && onDisableFuturePrompt) {
      onDisableFuturePrompt();
    }
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Start Live Route Tracking"
      size="md"
      footer={
        <div className="d-flex justify-content-between align-items-center w-100">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary px-3"
            onClick={onClose}
            id="start-tracking-cancel-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary px-4 fw-semibold"
            onClick={handleStart}
            id="start-tracking-confirm-btn"
          >
            <i className="bi bi-play-fill me-1"></i> Start Recording
          </button>
        </div>
      }
    >
      <div id="start-tracking-confirm-content">
        <div className="text-center py-2 mb-3">
          <div
            className="rounded-circle bg-primary-subtle text-primary mx-auto d-flex align-items-center justify-content-center mb-3"
            style={{ width: '56px', height: '56px' }}
          >
            <i className="bi bi-geo-alt-fill fs-3"></i>
          </div>
          <h5 className="fw-bold text-dark mb-1">Begin Recording Your Trip</h5>
          <p className="text-muted small mb-0">
            RoomTrail will actively record your movement path and detect visited room stops.
          </p>
        </div>

        <div className="bg-light p-3 rounded border mb-3 small">
          <ul className="mb-0 ps-3 text-secondary">
            <li className="mb-1">
              <strong>GPS Location Logging:</strong> Continuous breadcrumb points will be recorded as you travel.
            </li>
            <li className="mb-1">
              <strong>Stationary Stop Detection:</strong> Stops of 5+ minutes will automatically prompt you to save room notes.
            </li>
            <li className="mb-1">
              <strong>Nearby Room Radar:</strong> You will be notified when travelling near previously saved rooms.
            </li>
            <li>
              <strong>Private & Secure:</strong> All recorded route coordinates are scoped strictly to your account.
            </li>
          </ul>
        </div>

        <div className="form-check small text-muted">
          <input
            className="form-check-input"
            type="checkbox"
            id="dont-ask-start-tracking-checkbox"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
          />
          <label className="form-check-label" htmlFor="dont-ask-start-tracking-checkbox">
            Don't ask for confirmation next time (can be re-enabled in Safety Settings)
          </label>
        </div>
      </div>
    </Modal>
  );
};

export default StartTrackingConfirmModal;
