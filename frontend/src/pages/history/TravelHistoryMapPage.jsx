import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import FullTravelMap from '../../components/history/FullTravelMap';

const TravelHistoryMapPage = () => {
  const [searchParams] = useSearchParams();
  const tripIdParam = searchParams.get('tripId') || 'all';

  return (
    <div className="travel-history-map-page" id="full-travel-map-page-container">
      {/* Page Header */}
      <div className="page-header mb-3">
        <div>
          <h2 className="page-title">Full Travel Map</h2>
          <p className="page-subtitle">
            Simultaneous interactive visualization of all recorded GPS routes, trips, and saved room locations
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <Link to="/history" className="btn btn-outline-secondary btn-sm" id="map-page-back-to-table-btn">
            <i className="bi bi-list-ul me-1"></i> Journeys List
          </Link>
          <Link to="/live-tracking" className="btn btn-rt-secondary btn-sm" id="map-page-live-tracking-btn">
            <i className="bi bi-broadcast me-1"></i> Live Tracking
          </Link>
          <Link to="/rooms" className="btn btn-rt-primary btn-sm" id="map-page-saved-rooms-btn">
            <i className="bi bi-door-open me-1"></i> Saved Rooms
          </Link>
        </div>
      </div>

      {/* Main Full Travel Map Component */}
      <FullTravelMap initialTripId={tripIdParam} />
    </div>
  );
};

export default TravelHistoryMapPage;
