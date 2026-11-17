import React, { useState, useMemo } from 'react';
import Modal from '../common/Modal';
import { exportService } from '../../services';
import { useNotification } from '../../hooks/useNotification';

const ExportTravelHistoryModal = ({ isOpen, onClose, trips = [] }) => {
  const { showSuccess, showError } = useNotification();

  // Export Format: 'csv' | 'pdf' | 'route-points'
  const [exportFormat, setExportFormat] = useState('csv');

  // Date Filter: 'all' | 'custom'
  const [dateFilterType, setDateFilterType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Options
  const [includeStops, setIncludeStops] = useState(true);

  // Loading state
  const [exporting, setExporting] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Count matching trips for user feedback
  const matchingTripsCount = useMemo(() => {
    if (dateFilterType === 'all') {
      return trips.length;
    }
    return trips.filter((t) => {
      const tripDate = t.scheduledDate || (t.startTime ? t.startTime.slice(0, 10) : '') || (t.createdAt ? t.createdAt.slice(0, 10) : '');
      if (!tripDate) return true;
      if (startDate && tripDate < startDate) return false;
      if (endDate && tripDate > endDate) return false;
      return true;
    }).length;
  }, [trips, dateFilterType, startDate, endDate]);

  const handleDateChange = (field, value) => {
    setValidationError('');
    if (field === 'start') {
      setStartDate(value);
      if (endDate && value && value > endDate) {
        setValidationError('Start date cannot be after end date.');
      }
    } else {
      setEndDate(value);
      if (startDate && value && startDate > value) {
        setValidationError('End date cannot be earlier than start date.');
      }
    }
  };

  const handleExport = async () => {
    setValidationError('');

    if (dateFilterType === 'custom') {
      if (startDate && endDate && startDate > endDate) {
        setValidationError('End date cannot be earlier than start date.');
        return;
      }
    }

    if (matchingTripsCount === 0) {
      showError('No recorded journeys match the selected date filter.');
      return;
    }

    setExporting(true);

    const payload = {
      startDate: dateFilterType === 'custom' ? startDate : undefined,
      endDate: dateFilterType === 'custom' ? endDate : undefined,
      includeStops: includeStops,
    };

    try {
      let result;
      if (exportFormat === 'csv') {
        result = await exportService.exportTripsCsv(payload);
        showSuccess(`Exported "${result.filename}" successfully!`);
      } else if (exportFormat === 'pdf') {
        result = await exportService.exportTravelHistoryPdf(payload);
        showSuccess(`Exported "${result.filename}" successfully!`);
      } else if (exportFormat === 'route-points') {
        result = await exportService.exportRoutePointsCsv(payload);
        showSuccess(`Exported "${result.filename}" successfully!`);
      }
      onClose();
    } catch (err) {
      showError(err.message || 'Failed to generate export file. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-file-earmark-arrow-down text-primary"></i>
          <span>Export Travel History</span>
        </div>
      }
      size="md"
      footer={
        <div className="d-flex justify-content-between align-items-center w-100">
          <span className="small text-muted">
            <i className="bi bi-shield-check text-success me-1"></i>
            Authenticated User Data Only
          </span>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={onClose}
              disabled={exporting}
              id="export-modal-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary fw-semibold d-flex align-items-center gap-2"
              onClick={handleExport}
              disabled={exporting || Boolean(validationError) || matchingTripsCount === 0}
              id="export-modal-download-btn"
            >
              {exporting ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-download"></i>
                  <span>Download {exportFormat.toUpperCase()}</span>
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="p-1">
        {/* Format Selector */}
        <div className="mb-3">
          <label className="form-label fw-bold small text-uppercase text-secondary mb-2">
            1. Select Export Format
          </label>
          <div className="row g-2" id="export-format-selector">
            <div className="col-4">
              <div
                className={`p-3 border rounded text-center h-100 cursor-pointer transition-all ${
                  exportFormat === 'csv'
                    ? 'border-primary bg-primary bg-opacity-10 text-primary shadow-sm'
                    : 'bg-white hover-bg-light text-dark'
                }`}
                onClick={() => setExportFormat('csv')}
                id="format-csv-card"
                style={{ cursor: 'pointer' }}
              >
                <i className="bi bi-filetype-csv fs-3 d-block mb-1 text-success"></i>
                <div className="fw-bold small">Trip CSV</div>
                <div className="text-muted" style={{ fontSize: '0.68rem' }}>Summary & Stops</div>
              </div>
            </div>

            <div className="col-4">
              <div
                className={`p-3 border rounded text-center h-100 cursor-pointer transition-all ${
                  exportFormat === 'pdf'
                    ? 'border-primary bg-primary bg-opacity-10 text-primary shadow-sm'
                    : 'bg-white hover-bg-light text-dark'
                }`}
                onClick={() => setExportFormat('pdf')}
                id="format-pdf-card"
                style={{ cursor: 'pointer' }}
              >
                <i className="bi bi-filetype-pdf fs-3 d-block mb-1 text-danger"></i>
                <div className="fw-bold small">PDF Report</div>
                <div className="text-muted" style={{ fontSize: '0.68rem' }}>Visual Document</div>
              </div>
            </div>

            <div className="col-4">
              <div
                className={`p-3 border rounded text-center h-100 cursor-pointer transition-all ${
                  exportFormat === 'route-points'
                    ? 'border-primary bg-primary bg-opacity-10 text-primary shadow-sm'
                    : 'bg-white hover-bg-light text-dark'
                }`}
                onClick={() => setExportFormat('route-points')}
                id="format-route-points-card"
                style={{ cursor: 'pointer' }}
              >
                <i className="bi bi-geo-alt-fill fs-3 d-block mb-1 text-info"></i>
                <div className="fw-bold small">GPS Track</div>
                <div className="text-muted" style={{ fontSize: '0.68rem' }}>Route Points CSV</div>
              </div>
            </div>
          </div>
        </div>

        {/* Date Filtering */}
        <div className="mb-3">
          <label className="form-label fw-bold small text-uppercase text-secondary mb-2">
            2. Date Range Filtering
          </label>
          <div className="p-3 bg-light rounded border">
            <div className="form-check mb-2">
              <input
                className="form-check-input"
                type="radio"
                name="dateFilterRadio"
                id="date-filter-all"
                checked={dateFilterType === 'all'}
                onChange={() => {
                  setDateFilterType('all');
                  setValidationError('');
                }}
              />
              <label className="form-check-label fw-semibold small text-dark" htmlFor="date-filter-all">
                All Travel History ({trips.length} recorded journeys)
              </label>
            </div>

            <div className="form-check mb-2">
              <input
                className="form-check-input"
                type="radio"
                name="dateFilterRadio"
                id="date-filter-custom"
                checked={dateFilterType === 'custom'}
                onChange={() => setDateFilterType('custom')}
              />
              <label className="form-check-label fw-semibold small text-dark" htmlFor="date-filter-custom">
                Custom Date Range
              </label>
            </div>

            {dateFilterType === 'custom' && (
              <div className="row g-2 mt-1 ps-3">
                <div className="col-6">
                  <label htmlFor="export-start-date" className="form-label small text-muted mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="export-start-date"
                    className="form-control form-control-sm"
                    value={startDate}
                    onChange={(e) => handleDateChange('start', e.target.value)}
                  />
                </div>
                <div className="col-6">
                  <label htmlFor="export-end-date" className="form-label small text-muted mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    id="export-end-date"
                    className="form-control form-control-sm"
                    value={endDate}
                    onChange={(e) => handleDateChange('end', e.target.value)}
                  />
                </div>
              </div>
            )}

            {validationError && (
              <div className="alert alert-danger py-1 px-2 mt-2 mb-0 small" id="export-date-error">
                <i className="bi bi-exclamation-triangle-fill me-1"></i>
                {validationError}
              </div>
            )}
          </div>
        </div>

        {/* Content Options */}
        {exportFormat !== 'route-points' && (
          <div className="mb-3">
            <label className="form-label fw-bold small text-uppercase text-secondary mb-2">
              3. Content Options
            </label>
            <div className="p-3 bg-light rounded border">
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="opt-include-trips"
                  checked={true}
                  disabled
                />
                <label className="form-check-label small fw-semibold text-dark" htmlFor="opt-include-trips">
                  Trip Summaries (Dates, Start/End Locations, Distances, Durations)
                </label>
              </div>

              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="opt-include-stops"
                  checked={includeStops}
                  onChange={(e) => setIncludeStops(e.target.checked)}
                />
                <label className="form-check-label small fw-semibold text-dark" htmlFor="opt-include-stops">
                  Include Visited Stops & Observations (Timeline stops & private notes)
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Trip Summary Banner */}
        <div className="p-2 px-3 rounded bg-white border d-flex justify-content-between align-items-center">
          <div className="small text-muted">
            <i className="bi bi-info-circle me-1 text-primary"></i>
            Matching Trips: <strong className="text-dark" id="export-matching-count">{matchingTripsCount}</strong>
          </div>
          {matchingTripsCount === 0 && (
            <span className="badge bg-warning-subtle text-warning border border-warning-subtle small">
              No matching journeys
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ExportTravelHistoryModal;
