import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import GoogleMapsLocationLink from '../common/GoogleMapsLocationLink';
import { propertyService } from '../../services';
import { useNotification } from '../../hooks/useNotification';

/**
 * LocationNotesModal
 * RoomTrail Phase 1: Visited Location Notes Modal Form
 * Displays read-only location name and auto-detected address,
 * with a multi-line personal notes textarea, quick note suggestions,
 * and save/cancel actions.
 */
const LocationNotesModal = ({
  isOpen,
  onClose,
  property,
  onNotesSaved,
}) => {
  const { showSuccess, showError } = useNotification();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (property) {
      setNotes(property.notes || '');
      setErrorMsg(null);
    }
  }, [property, isOpen]);

  if (!property) return null;

  const quickPills = [
    'Room condition is good.',
    'Owner behaviour is friendly.',
    'Drinking water available.',
    'Parking facility available.',
    'Rent is negotiable.',
    'Nearby shops and transport facilities.',
  ];

  const handleAddQuickPill = (pillText) => {
    setNotes((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return pillText;
      if (trimmed.includes(pillText)) return prev;
      return `${trimmed}\n${pillText}`;
    });
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!property?.id) return;

    if (notes && notes.length > 5000) {
      setErrorMsg('Notes cannot exceed 5000 characters.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const updated = await propertyService.updateNotes(property.id, notes);
      showSuccess(`Notes saved for "${property.name || 'Location'}"`);
      if (onNotesSaved) {
        onNotesSaved(updated);
      }
      onClose();
    } catch (err) {
      console.error('Failed to save visited location notes:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to save notes. Please try again.';
      setErrorMsg(msg);
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="d-flex align-items-center gap-2">
          <span className="p-1 px-2 rounded bg-warning-subtle text-warning-emphasis">
            <i className="bi bi-sticky-fill"></i>
          </span>
          <span>{property.notes ? 'Edit Location Notes' : 'Add Visited Location Notes'}</span>
        </div>
      }
      size="md"
      footer={
        <div className="d-flex justify-content-between align-items-center w-100">
          <button
            type="button"
            id="cancel-location-notes-btn"
            className="btn btn-sm btn-outline-secondary px-3"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            id="save-location-notes-btn"
            className="btn btn-sm btn-primary px-4 fw-semibold shadow-sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                Saving Notes...
              </>
            ) : (
              <>
                <i className="bi bi-check2-circle me-1"></i> Save Notes
              </>
            )}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSave}>
        {/* Error Feedback */}
        {errorMsg && (
          <div className="alert alert-danger py-2 px-3 small mb-3 d-flex align-items-center gap-2">
            <i className="bi bi-exclamation-circle-fill"></i>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Read-Only Location / Room Name */}
        <div className="mb-3">
          <label htmlFor="notes-prop-name" className="form-label small fw-semibold text-secondary mb-1">
            <i className="bi bi-door-open me-1"></i> Location / Room Name (Read-Only)
          </label>
          <input
            type="text"
            id="notes-prop-name"
            className="form-control form-control-sm bg-light text-dark fw-medium"
            value={property.name || 'Unknown Location'}
            readOnly
          />
        </div>

        {/* Read-Only Automatically Identified Address */}
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <label htmlFor="notes-prop-address" className="form-label small fw-semibold text-secondary mb-0">
              <i className="bi bi-geo-alt me-1 text-danger"></i> Automatically Identified Address (Read-Only)
            </label>
            <GoogleMapsLocationLink
              place={property}
              variant="badge"
            >
              Google Maps
            </GoogleMapsLocationLink>
          </div>
          <input
            type="text"
            id="notes-prop-address"
            className="form-control form-control-sm bg-light text-secondary"
            value={property.address || `${property.latitude || ''}, ${property.longitude || ''}` || 'Coordinates centroid'}
            readOnly
          />
        </div>

        {/* Multi-line Notes Textarea */}
        <div className="mb-2">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <label htmlFor="location-notes-textarea" className="form-label small fw-bold text-dark mb-0">
              Personal Notes & Observations
            </label>
            <span className="small text-muted" style={{ fontSize: '0.75rem' }}>
              {notes.length} / 5000
            </span>
          </div>
          <textarea
            id="location-notes-textarea"
            className="form-control"
            rows="5"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Room condition is good. Owner behaviour is friendly. Drinking water available. Parking facility available. Rent is negotiable. Nearby shops and transport facilities..."
            maxLength={5000}
            style={{ fontSize: '0.9rem', lineHeight: '1.5' }}
          ></textarea>
          <div className="form-text small text-muted">
            Notes are optional, private to your account, and can be edited anytime later.
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="mt-3 p-2 bg-light rounded border">
          <span className="small text-muted fw-semibold d-block mb-1" style={{ fontSize: '0.72rem' }}>
            <i className="bi bi-lightbulb text-warning me-1"></i> QUICK OBSERVATIONS (TAP TO APPEND):
          </span>
          <div className="d-flex flex-wrap gap-1">
            {quickPills.map((pill, idx) => (
              <button
                key={idx}
                type="button"
                className="badge bg-white text-secondary border text-decoration-none fw-normal py-1 px-2"
                style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                onClick={() => handleAddQuickPill(pill)}
              >
                + {pill}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default LocationNotesModal;
