import React, { useState, useEffect } from 'react';
import { tripService } from '../../services';
import GoogleMapsLocationLink from '../../components/common/GoogleMapsLocationLink';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const TripTimelineView = ({ tripId, onBack, onOpenMap, journey }) => {
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchTimeline = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await tripService.getTimeline(tripId);
        if (isMounted) {
          setTimeline(data);
        }
      } catch (err) {
        console.error('Failed to load trip timeline:', err);
        if (isMounted) {
          setError(
            err.response?.status === 403
              ? 'Access forbidden: You do not have permission to view this trip timeline.'
              : 'Failed to load timeline details for this journey.'
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (tripId) {
      fetchTimeline();
    }
    return () => {
      isMounted = false;
    };
  }, [tripId]);

  if (loading) {
    return (
      <div className="bg-white rounded border shadow-sm p-5 text-center my-3" id="timeline-loading-container">
        <LoadingSpinner text="Loading chronological trip timeline..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded border shadow-sm p-4 my-3" id="timeline-error-container">
        <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
          <i className="bi bi-exclamation-triangle-fill fs-5"></i>
          <div>{error}</div>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={onBack}
          id="timeline-back-btn"
        >
          <i className="bi bi-arrow-left me-1"></i> Back to Travel History
        </button>
      </div>
    );
  }

  const tripName = timeline?.tripName || timeline?.title || journey?.tripName || journey?.title || 'Trip Timeline';
  const totalStops = timeline?.totalStopsCount ?? (timeline?.stops?.length || 0);
  const isCompleted = timeline?.status === 'completed';
  const isActive = timeline?.status === 'active';

  return (
    <div className="trip-timeline-view mb-4" id="trip-timeline-view-root">
      {/* Top Bar with Back and Map Action */}
      <div className="card shadow-sm border-0 mb-3 bg-white">
        <div className="card-body p-3 p-md-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center"
                onClick={onBack}
                id="timeline-back-btn"
                title="Return to Journeys List"
              >
                <i className="bi bi-arrow-left me-1"></i> Back to Travel History
              </button>
              <span className="text-muted">|</span>
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                <i className="bi bi-calendar3 me-1"></i> Trip #{timeline?.tripId || tripId}
              </span>
              <span
                className={`badge ${
                  isActive
                    ? 'bg-success-subtle text-success border border-success-subtle'
                    : 'bg-secondary-subtle text-secondary border border-secondary-subtle'
                } px-2 py-1`}
              >
                {isActive ? 'In Progress' : 'Completed'}
              </span>
            </div>

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-rt-primary btn-sm d-inline-flex align-items-center"
                onClick={() => onOpenMap(timeline || journey)}
                id="timeline-open-map-btn"
              >
                <i className="bi bi-map-fill me-1"></i> View on Route Map
              </button>
            </div>
          </div>

          <hr className="my-3 opacity-25" />

          {/* Trip Header & Metrics Banner */}
          <div className="row align-items-center g-3">
            <div className="col-12 col-lg-5">
              <h3 className="h5 fw-bold text-dark mb-1 d-flex align-items-center gap-2" id="timeline-trip-title">
                <i className="bi bi-signpost-split text-primary"></i>
                {tripName}
              </h3>
              <p className="text-muted small mb-0">
                <i className="bi bi-geo-alt me-1 text-secondary"></i>
                {timeline?.startLocation || 'Journey Origin'} &rarr; {timeline?.endLocation || 'Destination'}
              </p>
            </div>

            <div className="col-12 col-lg-7">
              <div className="row g-2 text-center">
                <div className="col-6 col-sm-3">
                  <div className="p-2 rounded bg-light border">
                    <div className="text-muted small" style={{ fontSize: '11px' }}>
                      <i className="bi bi-clock me-1 text-success"></i>Start Time
                    </div>
                    <strong className="text-dark small d-block text-truncate" id="timeline-metric-start-time">
                      {timeline?.startTimeFormatted || '--:--'}
                    </strong>
                  </div>
                </div>
                <div className="col-6 col-sm-3">
                  <div className="p-2 rounded bg-light border">
                    <div className="text-muted small" style={{ fontSize: '11px' }}>
                      <i className="bi bi-check-circle me-1 text-danger"></i>End Time
                    </div>
                    <strong className="text-dark small d-block text-truncate" id="timeline-metric-end-time">
                      {timeline?.endTimeFormatted || (isActive ? 'In Progress' : '--:--')}
                    </strong>
                  </div>
                </div>
                <div className="col-6 col-sm-3">
                  <div className="p-2 rounded bg-light border">
                    <div className="text-muted small" style={{ fontSize: '11px' }}>
                      <i className="bi bi-geo-alt-fill me-1 text-primary"></i>Stops
                    </div>
                    <strong className="text-primary small d-block" id="timeline-metric-stops-count">
                      {totalStops} {totalStops === 1 ? 'stop' : 'stops'}
                    </strong>
                  </div>
                </div>
                <div className="col-6 col-sm-3">
                  <div className="p-2 rounded bg-light border">
                    <div className="text-muted small" style={{ fontSize: '11px' }}>
                      <i className="bi bi-hourglass-split me-1 text-secondary"></i>Duration
                    </div>
                    <strong className="text-dark small d-block text-truncate" id="timeline-metric-duration">
                      {timeline?.totalDuration || journey?.durationDisplay || '35 mins'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vertical Timeline Card */}
      <div className="card shadow-sm border rounded bg-white p-3 p-md-4" id="timeline-tree-card">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="h6 fw-bold text-uppercase text-secondary mb-0 tracking-wide">
            <i className="bi bi-clock-history me-2 text-primary"></i>
            Chronological Journey Timeline
          </h4>
          <span className="text-muted small">
            Ordered by recorded time
          </span>
        </div>

        <div className="timeline-container position-relative px-2 py-1" style={{ maxWidth: '850px' }}>
          {/* Vertical connecting line */}
          <div
            className="timeline-track position-absolute"
            style={{
              top: '20px',
              bottom: '20px',
              left: '23px',
              width: '3px',
              background: 'linear-gradient(to bottom, #10b981 0%, #3b82f6 30%, #6366f1 70%, #ef4444 100%)',
              zIndex: 1,
            }}
          />

          {/* 1. Trip Started Event */}
          <div className="timeline-node d-flex gap-3 mb-4 position-relative" style={{ zIndex: 2 }} id="timeline-event-start">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center text-white shadow-sm flex-shrink-0"
              style={{
                width: '38px',
                height: '38px',
                backgroundColor: '#10b981',
                border: '3px solid #ffffff',
              }}
            >
              <i className="bi bi-play-fill fs-5" />
            </div>
            <div className="card border-success-subtle shadow-xs flex-grow-1 bg-light-subtle">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-1 mb-1">
                  <span className="badge bg-success-subtle text-success border border-success-subtle fw-semibold px-2 py-1">
                    <i className="bi bi-flag-fill me-1"></i> Trip Started
                  </span>
                  <span className="text-dark fw-bold small">
                    <i className="bi bi-clock me-1 text-success"></i>
                    {timeline?.startTimeFormatted || '--:--'}
                  </span>
                </div>
                <div className="fw-semibold text-dark fs-6 mt-1">
                  {timeline?.startLocation || 'Journey Starting Location'}
                </div>
                {timeline?.startLat && timeline?.startLng && (
                  <div className="text-muted small mt-1" style={{ fontSize: '11px' }}>
                    <i className="bi bi-geo me-1"></i>
                    {timeline.startLat.toFixed(5)}°, {timeline.startLng.toFixed(5)}°
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Detected Stops (Chronological order) */}
          {totalStops === 0 ? (
            <div className="timeline-node d-flex gap-3 mb-4 position-relative" style={{ zIndex: 2 }} id="timeline-no-stops-notice">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-white shadow-sm flex-shrink-0"
                style={{
                  width: '38px',
                  height: '38px',
                  backgroundColor: '#94a3b8',
                  border: '3px solid #ffffff',
                }}
              >
                <i className="bi bi-geo-alt text-white fs-6" />
              </div>
              <div className="card border-dashed border-2 flex-grow-1 bg-light py-3 px-3">
                <div className="d-flex align-items-start gap-2">
                  <i className="bi bi-info-circle-fill text-primary fs-5 mt-1"></i>
                  <div>
                    <h6 className="fw-bold text-dark mb-1">No Stationary Stops Recorded</h6>
                    <p className="text-muted small mb-0">
                      No stops were detected for this trip. RoomTrail automatically logs stops when you remain stationary at a location for more than 5 minutes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            timeline?.stops?.map((stop, index) => {
              const stopNumber = stop.stopNumber || index + 1;
              const hasNotes = Boolean(stop.notes && stop.notes.trim().length > 0);

              return (
                <div
                  key={stop.id || index}
                  className="timeline-node d-flex gap-3 mb-4 position-relative"
                  style={{ zIndex: 2 }}
                  id={`timeline-event-stop-${stopNumber}`}
                >
                  {/* Stop Number Circle Pin */}
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center text-white shadow-sm flex-shrink-0"
                    style={{
                      width: '38px',
                      height: '38px',
                      backgroundColor: '#4f46e5',
                      border: '3px solid #ffffff',
                      fontWeight: 'bold',
                      fontSize: '13px',
                    }}
                    title={`Stop #${stopNumber}`}
                  >
                    #{stopNumber}
                  </div>

                  {/* Stop Details Card */}
                  <div className="card shadow-xs flex-grow-1 border bg-white">
                    <div className="card-body p-3">
                      {/* Title & Badges */}
                      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                        <div>
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <span className="badge bg-indigo text-white px-2 py-1" style={{ backgroundColor: '#4f46e5' }}>
                              Stop #{stopNumber}
                            </span>
                            <span className="badge bg-secondary-subtle text-secondary text-capitalize px-2 py-1">
                              <i className="bi bi-door-closed me-1"></i>
                              {stop.category || 'Room'}
                            </span>
                            {stop.isRevisit && (
                              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1">
                                <i className="bi bi-arrow-repeat me-1"></i> Revisit
                              </span>
                            )}
                          </div>
                          <h5 className="h6 fw-bold text-dark mt-2 mb-0" id={`timeline-stop-name-${stopNumber}`}>
                            {stop.locationName}
                          </h5>
                          {stop.address && (
                            <div className="mt-1" id={`timeline-stop-address-${stopNumber}`} style={{ fontSize: '0.84rem' }}>
                              <GoogleMapsLocationLink
                                place={stop}
                              >
                                {stop.address}
                              </GoogleMapsLocationLink>
                            </div>
                          )}
                        </div>

                        {/* Duration Badge */}
                        <div className="text-end">
                          <span
                            className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 fs-7 fw-semibold"
                            id={`timeline-stop-duration-${stopNumber}`}
                          >
                            <i className="bi bi-hourglass-split me-1"></i>
                            {stop.duration}
                          </span>
                        </div>
                      </div>

                      {/* Timing Details Grid */}
                      <div className="row g-2 my-2 py-2 px-1 bg-light rounded border border-light-subtle">
                        <div className="col-12 col-sm-6">
                          <div className="small">
                            <span className="text-muted">
                              <i className="bi bi-box-arrow-in-right text-success me-1"></i>
                              <strong>Arrival:</strong>
                            </span>{' '}
                            <span className="text-dark fw-semibold" id={`timeline-stop-arrival-${stopNumber}`}>
                              {stop.arrivalTimeFormatted || stop.arrivalTime || '--:--'}
                            </span>
                          </div>
                        </div>
                        <div className="col-12 col-sm-6">
                          <div className="small">
                            <span className="text-muted">
                              <i className="bi bi-box-arrow-right text-danger me-1"></i>
                              <strong>Departure:</strong>
                            </span>{' '}
                            <span
                              className={`fw-semibold ${
                                stop.isActiveStop ? 'text-success' : 'text-dark'
                              }`}
                              id={`timeline-stop-departure-${stopNumber}`}
                            >
                              {stop.departureTimeFormatted || (stop.isActiveStop ? 'Currently at this location' : 'Departure not recorded')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Personal Notes (Owner Only) */}
                      {hasNotes && (
                        <div
                          className="mt-3 p-3 rounded border border-warning-subtle"
                          style={{ backgroundColor: '#fffbeb' }}
                          id={`timeline-stop-notes-${stopNumber}`}
                        >
                          <div className="d-flex align-items-center gap-1 text-warning-emphasis small fw-bold mb-1">
                            <i className="bi bi-journal-text fs-6"></i>
                            <span>Personal Notes</span>
                          </div>
                          <p className="mb-0 text-dark small" style={{ whiteSpace: 'pre-line' }}>
                            {stop.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* 3. Trip Ended Event */}
          <div className="timeline-node d-flex gap-3 position-relative" style={{ zIndex: 2 }} id="timeline-event-end">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center text-white shadow-sm flex-shrink-0"
              style={{
                width: '38px',
                height: '38px',
                backgroundColor: isCompleted ? '#ef4444' : '#64748b',
                border: '3px solid #ffffff',
              }}
            >
              <i className={isCompleted ? 'bi bi-check-circle-fill fs-5' : 'bi bi-arrow-right-circle fs-5'} />
            </div>
            <div className="card border-secondary-subtle shadow-xs flex-grow-1 bg-light-subtle">
              <div className="card-body p-3">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-1 mb-1">
                  <span
                    className={`badge ${
                      isCompleted
                        ? 'bg-danger-subtle text-danger border border-danger-subtle'
                        : 'bg-secondary-subtle text-secondary border border-secondary-subtle'
                    } fw-semibold px-2 py-1`}
                  >
                    <i className="bi bi-flag-fill me-1"></i> {isCompleted ? 'Trip Completed' : 'Trip In Progress'}
                  </span>
                  <span className="text-dark fw-bold small">
                    <i className="bi bi-check-circle me-1 text-danger"></i>
                    {timeline?.endTimeFormatted || (isActive ? 'In Progress' : '--:--')}
                  </span>
                </div>
                <div className="fw-semibold text-dark fs-6 mt-1">
                  {timeline?.endLocation || 'Journey Destination'}
                </div>
                {timeline?.endLat && timeline?.endLng && (
                  <div className="text-muted small mt-1" style={{ fontSize: '11px' }}>
                    <i className="bi bi-geo me-1"></i>
                    {timeline.endLat.toFixed(5)}°, {timeline.endLng.toFixed(5)}°
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripTimelineView;
