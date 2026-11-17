import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { trackingService } from '../../services/trackingService';
import { useNotification } from '../../hooks/useNotification';

const TrackingSafetySettingsModal = ({ isOpen, onClose, onPreferencesUpdated, currentPreferences }) => {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    trackingConfirmation: true,
    accuracyWarningMeters: 50,
    trackingReminderMinutes: 60,
    privacyReminderAcknowledged: true,
  });

  useEffect(() => {
    if (isOpen) {
      if (currentPreferences) {
        setFormData({
          trackingConfirmation: currentPreferences.trackingConfirmation ?? true,
          accuracyWarningMeters: currentPreferences.accuracyWarningMeters ?? 50,
          trackingReminderMinutes: currentPreferences.trackingReminderMinutes ?? 60,
          privacyReminderAcknowledged: currentPreferences.privacyReminderAcknowledged ?? true,
        });
      } else {
        fetchPreferences();
      }
    }
  }, [isOpen, currentPreferences]);

  const fetchPreferences = async () => {
    setLoading(true);
    try {
      const data = await trackingService.getTrackingPreferences();
      if (data) {
        setFormData({
          trackingConfirmation: data.trackingConfirmation ?? true,
          accuracyWarningMeters: data.accuracyWarningMeters ?? 50,
          trackingReminderMinutes: data.trackingReminderMinutes ?? 60,
          privacyReminderAcknowledged: data.privacyReminderAcknowledged ?? true,
        });
      }
    } catch (err) {
      console.warn('Failed to load tracking preferences from server', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const updated = await trackingService.updateTrackingPreferences(formData);
      showSuccess('Tracking safety settings updated successfully!');
      if (onPreferencesUpdated) {
        onPreferencesUpdated(updated);
      }
      onClose();
    } catch (err) {
      console.error('Failed to update tracking preferences', err);
      showError(err.response?.data?.message || 'Failed to save tracking safety settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tracking Safety & Privacy Settings"
      size="md"
      footer={
        <div className="d-flex justify-content-between align-items-center w-100">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary px-3"
            onClick={handleSave}
            disabled={saving || loading}
            id="save-tracking-safety-settings-btn"
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                Saving...
              </>
            ) : (
              <>
                <i className="bi bi-check2-circle me-1"></i> Save Preferences
              </>
            )}
          </button>
        </div>
      }
    >
      <div id="tracking-safety-settings-content">
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary spinner-border-sm mb-2" role="status"></div>
            <p className="text-muted small mb-0">Loading safety settings...</p>
          </div>
        ) : (
          <form onSubmit={handleSave}>
            {/* A. Tracking Confirmation Before Starting */}
            <div className="card shadow-xs border mb-3">
              <div className="card-body p-3">
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <h6 className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
                      <i className="bi bi-shield-check text-primary"></i>
                      Start Tracking Confirmation
                    </h6>
                    <p className="text-muted small mb-0">
                      Require an explicit confirmation dialog explaining GPS recording before beginning a new trip.
                    </p>
                  </div>
                  <div className="form-check form-switch ms-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="tracking-confirmation-switch"
                      style={{ width: '2.5rem', height: '1.3rem', cursor: 'pointer' }}
                      checked={formData.trackingConfirmation}
                      onChange={(e) =>
                        setFormData({ ...formData, trackingConfirmation: e.target.checked })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* B. Accuracy Warning Threshold */}
            <div className="card shadow-xs border mb-3">
              <div className="card-body p-3">
                <h6 className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-broadcast-pin text-warning"></i>
                  GPS Accuracy Warning Threshold
                </h6>
                <p className="text-muted small mb-2">
                  Alert you with a visible warning banner if GPS accuracy degrades beyond this threshold.
                </p>

                <div className="btn-group btn-group-sm w-100" role="group">
                  {[25, 50, 100].map((meters) => (
                    <button
                      key={meters}
                      type="button"
                      className={`btn ${
                        formData.accuracyWarningMeters === meters ? 'btn-primary' : 'btn-outline-primary'
                      }`}
                      onClick={() => setFormData({ ...formData, accuracyWarningMeters: meters })}
                      id={`accuracy-threshold-${meters}-btn`}
                    >
                      ±{meters} m {meters === 50 ? '(Default)' : ''}
                    </button>
                  ))}
                </div>
                <div className="text-muted small mt-1" style={{ fontSize: '11px' }}>
                  Warnings are informative only; RoomTrail never fabricates or silently modifies GPS readings.
                </div>
              </div>
            </div>

            {/* C. Extended Tracking Duration Reminders */}
            <div className="card shadow-xs border mb-3">
              <div className="card-body p-3">
                <h6 className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-alarm text-info"></i>
                  Active Tracking Reminder
                </h6>
                <p className="text-muted small mb-2">
                  Receive a non-intrusive reminder when tracking continuously for an extended time.
                </p>

                <div className="btn-group btn-group-sm w-100" role="group">
                  {[
                    { label: 'Off', val: 0 },
                    { label: '30 min', val: 30 },
                    { label: '60 min', val: 60 },
                    { label: '120 min', val: 120 },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      className={`btn ${
                        formData.trackingReminderMinutes === item.val
                          ? 'btn-primary'
                          : 'btn-outline-primary'
                      }`}
                      onClick={() => setFormData({ ...formData, trackingReminderMinutes: item.val })}
                      id={`reminder-interval-${item.val}-btn`}
                    >
                      {item.label} {item.val === 60 ? '(Default)' : ''}
                    </button>
                  ))}
                </div>
                <div className="text-muted small mt-1" style={{ fontSize: '11px' }}>
                  Reminders are non-intrusive banners and will not stop or interrupt your active trip.
                </div>
              </div>
            </div>

            {/* D. Location Data Privacy Reminder Notice */}
            <div className="alert alert-info border-0 shadow-xs mb-0 p-3 small d-flex align-items-start gap-2">
              <i className="bi bi-lock-fill text-primary fs-5 mt-1 flex-shrink-0"></i>
              <div>
                <strong className="text-dark">Location Privacy Protection:</strong>
                <div className="text-muted mt-1">
                  Recorded GPS routes contain sensitive location history stored strictly in your private RoomTrail account.
                  Platform administrators cannot view your private journeys, and you can permanently delete individual trips at any time.
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default TrackingSafetySettingsModal;
