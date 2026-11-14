import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { propertyService, tripService, visitService, routingService } from '../../services';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import QuickAddPlaceModal from '../../components/places/QuickAddPlaceModal';
import { formatDate, getCategoryIcon } from '../../utils/formatters';

const DashboardPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalDestinations: 0,
    visitedDestinations: 0,
    pendingDestinations: 0,
    activeTrips: 0,
  });
  const [properties, setProperties] = useState([]);
  const [trips, setTrips] = useState([]);
  const [visits, setVisits] = useState([]);
  const [nextDestination, setNextDestination] = useState(null);
  const [smartSuggestionData, setSmartSuggestionData] = useState(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const [propsData, tripsData, visitsData] = await Promise.all([
          propertyService.getAll(),
          tripService.getAll(),
          visitService.getAll(),
        ]);

        const userProps = user?.id ? propsData.filter((p) => !p.userId || p.userId === user.id) : propsData;
        const userTrips = user?.id ? tripsData.filter((t) => !t.userId || t.userId === user.id) : tripsData;
        const userVisits = user?.id ? visitsData.filter((v) => !v.userId || v.userId === user.id) : visitsData;

        const visitedCount = userProps.filter((p) => p.visited).length;
        const pendingCount = userProps.filter((p) => !p.visited).length;
        const activeTripsCount = userTrips.filter((t) => t.status === 'active').length;

        setProperties(userProps);
        setTrips(userTrips);
        setVisits(userVisits);

        setMetrics({
          totalDestinations: userProps.length,
          visitedDestinations: visitedCount,
          pendingDestinations: pendingCount,
          activeTrips: activeTripsCount,
        });

        // Smart Destination Recommendation Algorithm:
        // Evaluates GPS coords, road distance, estimated duration, priority, and visit status
        const startLat = user?.homeCoordinates?.lat || 12.9716;
        const startLng = user?.homeCoordinates?.lng || 77.5946;

        try {
          const smartChoice = await routingService.getSmartNextDestination({
            currentLat: startLat,
            currentLng: startLng,
            destinations: userProps,
            profile: user?.travelMode || 'driving',
          });

          if (smartChoice?.destination) {
            setNextDestination(smartChoice.destination);
            setSmartSuggestionData(smartChoice);
          } else {
            // Fallback to highest priority pending
            const pendingList = userProps.filter((p) => !p.visited);
            const sortedPending = pendingList.sort((a, b) => {
              const priorityScore = { high: 3, medium: 2, low: 1 };
              return (priorityScore[b.priority] || 1) - (priorityScore[a.priority] || 1);
            });
            setNextDestination(sortedPending[0] || null);
            setSmartSuggestionData(null);
          }
        } catch (e) {
          console.warn('Smart destination recommendation fallback', e);
          const pendingList = userProps.filter((p) => !p.visited);
          setNextDestination(pendingList[0] || null);
          setSmartSuggestionData(null);
        }
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div>
      {/* Welcome & Overview Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">
            {getGreeting()}, {user?.fullName || user?.username || 'Explorer'}!
          </h2>
          <p className="page-subtitle">
            Here is your real-time travel and destination overview for {user?.city || 'your area'}
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-rt-accent btn-sm d-flex align-items-center gap-1"
            onClick={() => setIsQuickAddOpen(true)}
            id="dashboard-quick-add-btn"
          >
            <i className="bi bi-lightning-charge-fill"></i> Quick Add Destination
          </button>
          <Link to="/places/new" className="btn btn-rt-primary btn-sm">
            <i className="bi bi-plus-lg"></i>
            Add Destination
          </Link>
          <Link to="/live-tracking" className="btn btn-rt-secondary btn-sm">
            <i className="bi bi-broadcast"></i>
            Live Tracking
          </Link>
        </div>
      </div>

      {/* 4 Required Metric Cards */}
      <div className="row g-3 mb-4">
        {/* Metric 1: Total Saved Destinations */}
        <div className="col-6 col-lg-3">
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ backgroundColor: 'var(--rt-blue-50)', color: 'var(--rt-blue-500)' }}
            >
              <i className="bi bi-geo-alt"></i>
            </div>
            <div>
              <div className="text-muted small">Total Saved</div>
              <div className="fs-4 fw-bold text-dark">
                {loading ? '...' : metrics.totalDestinations}
              </div>
            </div>
          </div>
        </div>

        {/* Metric 2: Visited Destinations */}
        <div className="col-6 col-lg-3">
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}
            >
              <i className="bi bi-check-circle-fill"></i>
            </div>
            <div>
              <div className="text-muted small">Visited Places</div>
              <div className="fs-4 fw-bold text-dark">
                {loading ? '...' : metrics.visitedDestinations}
              </div>
            </div>
          </div>
        </div>

        {/* Metric 3: Pending Destinations */}
        <div className="col-6 col-lg-3">
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ backgroundColor: '#fffbeb', color: '#f59e0b' }}
            >
              <i className="bi bi-clock-history"></i>
            </div>
            <div>
              <div className="text-muted small">Pending Visits</div>
              <div className="fs-4 fw-bold text-dark">
                {loading ? '...' : metrics.pendingDestinations}
              </div>
            </div>
          </div>
        </div>

        {/* Metric 4: Active Trips */}
        <div className="col-6 col-lg-3">
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
            >
              <i className="bi bi-signpost-2"></i>
            </div>
            <div>
              <div className="text-muted small">Active Trips</div>
              <div className="fs-4 fw-bold text-dark">
                {loading ? '...' : metrics.activeTrips}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="rt-card p-3 mb-4">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <span className="fw-bold small text-muted text-uppercase">
            <i className="bi bi-lightning-charge text-warning me-1"></i> Quick Actions
          </span>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link to="/places/new" className="btn btn-rt-secondary btn-sm">
            <i className="bi bi-plus-circle text-primary"></i>
            Save New Place
          </Link>
          <Link to="/trips" className="btn btn-rt-secondary btn-sm">
            <i className="bi bi-signpost text-success"></i>
            Plan Travel Trip
          </Link>
          <Link to="/map-explorer" className="btn btn-rt-secondary btn-sm">
            <i className="bi bi-map text-info"></i>
            Open Map Explorer
          </Link>
          <Link to="/live-tracking" className="btn btn-rt-secondary btn-sm">
            <i className="bi bi-broadcast text-danger"></i>
            Live Route Tracking
          </Link>
          <Link to="/history" className="btn btn-rt-secondary btn-sm">
            <i className="bi bi-clock-history text-secondary"></i>
            Review Visit History
          </Link>
        </div>
      </div>

      {/* Row: Next Destination Section & Map Preview */}
      <div className="row g-4 mb-4">
        {/* Next Destination Section */}
        <div className="col-lg-5">
          <div className="rt-card h-100">
            <div className="rt-card-header">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-crosshair text-danger fs-5"></i>
                <div>
                  <h6 className="fw-bold mb-0 text-dark">Smart Next Destination</h6>
                  <div className="text-muted" style={{ fontSize: '10px' }}>
                    Ranked via Road Distance, Travel Duration & Priority
                  </div>
                </div>
              </div>
              {nextDestination && (
                <span className={`badge ${nextDestination.priority === 'high' ? 'priority-badge-high' : 'badge-rt-primary'}`}>
                  {nextDestination.priority ? `${nextDestination.priority.toUpperCase()} PRIORITY` : 'RECOMMENDED'}
                </span>
              )}
            </div>
            <div className="rt-card-body">
              {loading ? (
                <LoadingSpinner text="Computing optimal road recommendations..." />
              ) : nextDestination ? (
                <div className="d-flex flex-column h-100 justify-content-between">
                  <div>
                    {smartSuggestionData && (
                      <div className="p-2 mb-2 rounded border small text-dark d-flex align-items-center justify-content-between" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                        <span className="fw-semibold text-success small">
                          <i className="bi bi-stars text-warning me-1"></i> {smartSuggestionData.reason}
                        </span>
                        <span className="badge bg-success-subtle text-success">
                          {smartSuggestionData.roadDistanceKm} • {smartSuggestionData.roadDurationMinutes}
                        </span>
                      </div>
                    )}

                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="badge category-flat text-uppercase">
                        <i className={`bi ${getCategoryIcon(nextDestination.category)} me-1`}></i>
                        {nextDestination.category || 'Rental'}
                      </span>
                      {nextDestination.rent && (
                        <span className="place-price-tag">{nextDestination.rent}</span>
                      )}
                    </div>
                    <h5 className="fw-bold text-dark mb-1">{nextDestination.name}</h5>
                    <p className="text-muted small mb-2">
                      <i className="bi bi-geo-alt me-1 text-primary"></i>
                      {nextDestination.address || 'Address on record'}
                    </p>

                    {/* Road Routing Distance & Travel Time Box */}
                    <div className="p-2 rounded bg-light border mb-3 small d-flex justify-content-between align-items-center">
                      <span>
                        <i className="bi bi-signpost-split me-1 text-primary"></i> Road Distance: <strong>{smartSuggestionData?.roadDistanceKm || 'Calculating...'}</strong>
                      </span>
                      <span>
                        <i className="bi bi-stopwatch me-1 text-warning"></i> Est. Time: <strong>{smartSuggestionData?.roadDurationMinutes || '~10 mins'}</strong>
                      </span>
                    </div>

                    {nextDestination.contactPhone && (
                      <div className="p-2 rounded bg-light border small text-muted mb-3 d-flex align-items-center justify-content-between">
                        <span><i className="bi bi-telephone me-1"></i> Contact: {nextDestination.contactPerson || 'Manager'}</span>
                        <a href={`tel:${nextDestination.contactPhone}`} className="fw-semibold text-primary text-decoration-none">
                          {nextDestination.contactPhone}
                        </a>
                      </div>
                    )}

                    {nextDestination.notes && (
                      <div className="p-2 rounded border small text-secondary mb-3" style={{ backgroundColor: 'var(--rt-blue-50)' }}>
                        <i className="bi bi-card-text me-1 text-primary"></i>
                        {nextDestination.notes}
                      </div>
                    )}
                  </div>

                  <div className="d-flex gap-2 pt-3 border-top mt-auto">
                    <Link to="/map-explorer" className="btn btn-rt-secondary btn-sm flex-grow-1 text-center justify-content-center">
                      <i className="bi bi-map"></i> View on Map
                    </Link>
                    <Link to="/live-tracking" className="btn btn-rt-primary btn-sm flex-grow-1 text-center justify-content-center">
                      <i className="bi bi-broadcast"></i> Start Live Tracking
                    </Link>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon="bi-pin-map"
                  title="No pending destinations"
                  description="All saved places have been visited, or you haven't saved any locations yet."
                  actionLabel="Add a Destination"
                  actionIcon="bi-plus-lg"
                  onAction={() => (window.location.href = '/places/new')}
                />
              )}
            </div>
          </div>
        </div>

        {/* Map Preview Container */}
        <div className="col-lg-7">
          <div className="rt-card h-100 d-flex flex-column">
            <div className="rt-card-header">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-map text-primary"></i>
                <h6 className="fw-bold mb-0 text-dark">Map Preview & Location Radar</h6>
              </div>
              <Link to="/map-explorer" className="small text-primary text-decoration-none fw-medium">
                Full Map Explorer <i className="bi bi-arrow-right"></i>
              </Link>
            </div>
            <div className="rt-card-body p-0 flex-grow-1 d-flex flex-column">
              <div
                className="position-relative flex-grow-1 d-flex align-items-center justify-content-center"
                style={{
                  minHeight: '260px',
                  backgroundColor: '#f1f5f9',
                  backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              >
                <div className="text-center p-4">
                  <div
                    className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                    style={{
                      width: '60px',
                      height: '60px',
                      backgroundColor: 'rgba(2, 132, 199, 0.1)',
                      color: 'var(--rt-blue-600)',
                      fontSize: '1.75rem',
                    }}
                  >
                    <i className="bi bi-compass"></i>
                  </div>
                  <h6 className="fw-bold text-dark mb-1">
                    {user?.city ? `Centered on ${user.city}` : 'OpenStreetMap Preview'}
                  </h6>
                  <p className="text-muted small mx-auto mb-3" style={{ maxWidth: '380px' }}>
                    {properties.length} saved destinations ready for live route tracking and proximity detection.
                  </p>
                  <Link to="/map-explorer" className="btn btn-rt-primary btn-sm">
                    <i className="bi bi-arrows-fullscreen"></i>
                    Launch Interactive Explorer
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="rt-card">
        <div className="rt-card-header">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-activity text-primary"></i>
            <h6 className="fw-bold mb-0 text-dark">Recent Activity</h6>
          </div>
          <Link to="/history" className="small text-primary text-decoration-none fw-medium">
            View All History <i className="bi bi-arrow-right"></i>
          </Link>
        </div>
        <div className="rt-card-body p-0">
          {loading ? (
            <LoadingSpinner text="Loading recent activity..." />
          ) : properties.length === 0 && trips.length === 0 && visits.length === 0 ? (
            <EmptyState
              icon="bi-clock-history"
              title="No recent activity yet"
              description="Your saved places, trip route logs, and visit confirmation timestamps will appear here in chronological order."
              actionLabel="Add Your First Place"
              actionIcon="bi-plus-lg"
              onAction={() => (window.location.href = '/places/new')}
            />
          ) : (
            <div className="list-group list-group-flush">
              {properties.slice(0, 4).map((prop) => (
                <div key={prop.id} className="list-group-item p-3 border-bottom d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center"
                      style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: prop.visited ? '#ecfdf5' : '#eff6ff',
                        color: prop.visited ? '#10b981' : '#2563eb',
                      }}
                    >
                      <i className={`bi ${prop.visited ? 'bi-check-lg' : 'bi-pin-map'}`}></i>
                    </div>
                    <div>
                      <div className="fw-semibold text-dark small">{prop.name}</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                        {prop.address || 'Address recorded'} • {prop.category || 'Rental'}
                      </div>
                    </div>
                  </div>
                  <div className="text-end">
                    <span className={`badge ${prop.visited ? 'bg-success' : 'bg-warning text-dark'} small`}>
                      {prop.visited ? 'Visited' : 'Pending'}
                    </span>
                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                      {formatDate(prop.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Add Destination Modal */}
      <QuickAddPlaceModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={(newPlace) => {
          setProperties((prev) => [newPlace, ...prev]);
          setMetrics((m) => ({
            ...m,
            totalDestinations: m.totalDestinations + 1,
            pendingDestinations: newPlace.visited ? m.pendingDestinations : m.pendingDestinations + 1,
            visitedDestinations: newPlace.visited ? m.visitedDestinations + 1 : m.visitedDestinations,
          }));
        }}
      />
    </div>
  );
};

export default DashboardPage;
