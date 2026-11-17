import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { propertyService } from '../../services';
import { useNotification } from '../../hooks/useNotification';

/**
 * AddRoomDetailsModal
 * RoomTrail Phase 5: Optional Room Details Modal
 * Allows adding monthly rent, contact number, room details, and personal notes
 * after an automatic 5-minute stop save.
 */
const AddRoomDetailsModal = ({
  isOpen,
  onClose,
  property,
  onPropertyUpdated,
}) => {
  const { showSuccess, showError } = useNotification();

  const [propertyName, setPropertyName] = useState('');
  const [rent, setRent] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [roomDetails, setRoomDetails] = useState('');
  const [personalNotes, setPersonalNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (property) {
      setPropertyName(property.name || 'Unknown Location');
      setRent(property.rent || property.price || '');
      setContactNumber(property.contactNumber || property.contactPhone || '');
      setRoomDetails(property.description || '');
      setPersonalNotes(property.notes || '');
    }
  }, [property]);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!property?.id) return;

    setSaving(true);
    try {
      const updates = {
        name: propertyName.trim() || property.name || 'Unknown Location',
        rent: rent.trim(),
        price: rent.trim(),
        contactNumber: contactNumber.trim(),
        contactPhone: contactNumber.trim(),
        description: roomDetails.trim(),
        notes: personalNotes.trim(),
      };

      const updated = await propertyService.update(property.id, updates);
      showSuccess(`Room details updated for "${updated.name || propertyName}"!`);
      if (onPropertyUpdated) {
        onPropertyUpdated(updated);
      }
      onClose();
    } catch (err) {
      console.error('Failed to update room details:', err);
      showError('Failed to save room details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!property) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Room Details"
      size="md"
      footer={
        <div className="d-flex justify-content-between align-items-center w-100">
          <button
            type="button"
            id="room-details-skip-btn"
            className="btn btn-sm btn-outline-secondary px-3"
            onClick={onClose}
            disabled={saving}
          >
            Skip for Now
          </button>
          <button
            type="button"
            id="room-details-save-btn"
            className="btn btn-sm btn-rt-primary px-4 fw-semibold"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                Saving...
              </>
            ) : (
              <>
                <i className="bi bi-check-circle-fill me-1"></i> Save Room Details
              </>
            )}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSave}>
        {/* Auto-saved Location Header */}
        <div className="alert alert-info border-info d-flex align-items-start gap-2 p-2 mb-3">
          <i className="bi bi-geo-alt-fill text-primary fs-5 mt-1"></i>
          <div className="small">
            <span className="fw-bold">Auto-Saved Property:</span> Location was automatically saved to MySQL upon detecting a 5-minute stop. You can now add room specifics below or skip anytime.
          </div>
        </div>

        {/* Property Name */}
        <div className="mb-3">
          <label htmlFor="room-details-prop-name" className="form-label small fw-bold mb-1">
            Property / Building Name
          </label>
          <input
            type="text"
            id="room-details-prop-name"
            className="form-control form-control-sm"
            value={propertyName}
            onChange={(e) => setPropertyName(e.target.value)}
            placeholder="e.g. Green Nest PG, Sai Residency, etc."
          />
          <div className="form-text small text-muted">
            Auto-detected from coordinates. You can edit this freely.
          </div>
        </div>

        {/* Address and City Info (Read-only reference) */}
        <div className="row g-2 mb-3">
          <div className="col-8">
            <label className="form-label small text-muted mb-1">Address</label>
            <input
              type="text"
              className="form-control form-control-sm bg-light"
              value={property.address || 'Coordinates centroid'}
              readOnly
            />
          </div>
          <div className="col-4">
            <label className="form-label small text-muted mb-1">City</label>
            <input
              type="text"
              className="form-control form-control-sm bg-light"
              value={property.city || 'Hyderabad'}
              readOnly
            />
          </div>
        </div>

        {/* Monthly Rent and Contact Number */}
        <div className="row g-2 mb-3">
          <div className="col-6">
            <label htmlFor="room-details-rent" className="form-label small fw-bold mb-1">
              Monthly Rent
            </label>
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white">₹</span>
              <input
                type="text"
                id="room-details-rent"
                className="form-control form-control-sm"
                value={rent}
                onChange={(e) => setRent(e.target.value)}
                placeholder="e.g. 8,000"
              />
            </div>
          </div>
          <div className="col-6">
            <label htmlFor="room-details-contact" className="form-label small fw-bold mb-1">
              Contact Number
            </label>
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white">
                <i className="bi bi-telephone"></i>
              </span>
              <input
                type="text"
                id="room-details-contact"
                className="form-control form-control-sm"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="e.g. 9876543210"
              />
            </div>
          </div>
        </div>

        {/* Room Details / Description */}
        <div className="mb-3">
          <label htmlFor="room-details-desc" className="form-label small fw-bold mb-1">
            Room Details
          </label>
          <input
            type="text"
            id="room-details-desc"
            className="form-control form-control-sm"
            value={roomDetails}
            onChange={(e) => setRoomDetails(e.target.value)}
            placeholder="e.g. 1 RK, Single room with attached bath, 2nd floor"
          />
        </div>

        {/* Personal Notes */}
        <div className="mb-2">
          <label htmlFor="room-details-notes" className="form-label small fw-bold mb-1">
            Personal Notes & Impressions
          </label>
          <textarea
            id="room-details-notes"
            rows="3"
            className="form-control form-control-sm"
            value={personalNotes}
            onChange={(e) => setPersonalNotes(e.target.value)}
            placeholder="e.g. Food available, good ventilation, owner ready to negotiate, deposit 2 months..."
          ></textarea>
        </div>
      </form>
    </Modal>
  );
};

export default AddRoomDetailsModal;
