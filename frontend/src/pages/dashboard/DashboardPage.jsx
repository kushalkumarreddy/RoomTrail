import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { propertyService, tripSummaryService } from '../../services';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import QuickAddPlaceModal from '../../components/places/QuickAddPlaceModal';
import { formatDate, getCategoryIcon } from '../../utils/formatters';

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState([]);
  const [tripSummaries, setTripSummaries] = useState([]);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  useEffect(() => {
    // Tracking always initializes as idle; clean any stale tracking session
    localStorage.removeItem('roomtrail_active_tracking_session');

    const loadData = async () => {
      setLoading(true);
      try {
        const [propsData, summariesData] = await Promise.all([
          propertyService.getAll().catch(() => []),
          tripSummaryService.getAll().catch(() => []),
        ]);

        const userProps = user?.id
          ? propsData.filter((p) => !p.userId || p.userId === user.id)
          : propsData;
        const userSummaries = user?.id
          ? summariesData.filter((s) => !s.userId || s.userId === user.id)
          : summariesData;

        setProperties(userProps);
        setTripSummaries(userSummaries);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Tracking initializes as idle; active sessions only run on explicit user action
  const trackingStatus = 'idle';
  const isTrackingActive = false;
  const isTrackingPaused = false;

  // Total distance travelled today (km)
  const distanceTodayKm = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    let totalMeters = 0;

    // Sum from finalized trip summaries recorded today
    tripSummaries.forEach((s) => {
      const sDate = s.createdAt || s.endTime || '';
      if (sDate.startsWith(todayStr)) {
        totalMeters += Number(s.totalDistanceMeters || 0);
      }
    });

    return (totalMeters / 1000).toFixed(1);
  }, [tripSummaries]);

  // Sorted recently saved rooms (newest first)
  const recentRooms = useMemo(() => {
    return [...properties]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 4);
  }, [properties]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return <LoadingSpinner fullPage text="Loading your dashboard..." />;
  }

  return (
    <div>
      {/* Welcome Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">
            {getGreeting()}, {user?.fullName || user?.username || 'Explorer'}!
          </h2>
          <p className="page-subtitle">
            Welcome to RoomTrail — your simple GPS companion for finding rental rooms and flats.
          </p>
        </div>

        {/* Start / Continue Tracking Action */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-rt-accent btn-sm d-flex align-items-center gap-1"
            onClick={() => setIsQuickAddOpen(true)}
            id="dashboard-quick-save-btn"
          >
            <i className="bi bi-plus-circle-fill"></i> Quick Save Room
          </button>

          <Link
            to="/live-tracking"
            className="btn btn-rt-primary btn-sm d-flex align-items-center gap-2 px-3 py-2"
          >
            {isTrackingActive ? (
              <>
                <span className="status-live-dot"></span>
                <span>Active Tracking in Progress</span>
              </>
            ) : isTrackingPaused ? (
              <>
                <i className="bi bi-pause-circle-fill text-warning"></i>
                <span>Resume Tracking</span>
              </>
            ) : (
              <>
                <i className="bi bi-play-fill fs-5"></i>
                <span className="fw-semibold">Start Tracking</span>
              </>
            )}
          </Link>
        </div>
      </div>

      {/* 3 Focused Metric Cards */}
      <div className="row g-3 mb-4">
        {/* Metric 1: Tracking Status */}
        <div className="col-12 col-md-4">
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{
                backgroundColor: isTrackingActive ? '#ecfdf5' : isTrackingPaused ? '#fffbeb' : '#f1f5f9',
                color: isTrackingActive ? '#10b981' : isTrackingPaused ? '#f59e0b' : '#64748b',
              }}
            >
              <i className={`bi ${isTrackingActive ? 'bi-broadcast-pin' : isTrackingPaused ? 'bi-pause-circle' : 'bi-geo-alt'}`}></i>
            </div>
            <div>
              <div className="text-muted small">Tracking Status</div>
              <div className="fs-5 fw-bold text-dark d-flex align-items-center gap-2">
                {isTrackingActive ? (
                  <span className="text-success d-flex align-items-center gap-1">
                    <span className="status-live-dot"></span> Tracking Active
                  </span>
                ) : isTrackingPaused ? (
                  <span className="text-warning">Paused</span>
                ) : (
                  <span className="text-secondary">Tracking Idle</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Metric 2: Distance Travelled Today */}
        <div className="col-6 col-md-4">
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ backgroundColor: 'var(--rt-blue-50)', color: 'var(--rt-blue-500)' }}
            >
              <i className="bi bi-signpost-2"></i>
            </div>
            <div>
              <div className="text-muted small">Distance Travelled Today</div>
              <div className="fs-4 fw-bold text-dark">
                {distanceTodayKm} <span className="fs-6 fw-normal text-muted">km</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metric 3: Number of Locations Saved */}
        <div className="col-6 col-md-4">
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
            >
              <i className="bi bi-door-open"></i>
            </div>
            <div>
              <div className="text-muted small">Saved Rooms</div>
              <div className="fs-4 fw-bold text-dark">
                {properties.length} <span className="fs-6 fw-normal text-muted">locations</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Row: Tracking CTA Banner & Recently Saved Rooms */}
      <div className="row g-4 mb-4">
        {/* Left: Simple Live Tracking Banner */}
        <div className="col-lg-5">
          <div className="rt-card h-100 p-4 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: '42px', height: '42px', backgroundColor: 'var(--rt-blue-50)', color: 'var(--rt-blue-600)' }}
                >
                  <i className="bi bi-compass fs-5"></i>
                </div>
                <div>
                  <h6 className="fw-bold mb-0 text-dark">Ready for Room Search</h6>
                  <span className="text-muted small">GPS Route Recording & Stop Detection</span>
                </div>
              </div>
              <p className="text-muted small mb-3">
                Start tracking when you leave home. RoomTrail records the roads you travel, notifies you if you repeat a road, and automatically saves locations where you stop for more than five minutes.
              </p>
            </div>

            <div className="pt-3 border-top">
              <Link to="/live-tracking" className="btn btn-rt-primary w-100 justify-content-center py-2">
                <i className="bi bi-broadcast me-1"></i> Open Live Tracking Map
              </Link>
            </div>
          </div>
        </div>

        {/* Right: Recently Saved Rooms */}
        <div className="col-lg-7">
          <div className="rt-card h-100 d-flex flex-column">
            <div className="rt-card-header">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-clock-history text-primary"></i>
                <h6 className="fw-bold mb-0 text-dark">Recently Saved Rooms</h6>
              </div>
              <Link to="/rooms" className="small text-primary text-decoration-none fw-medium">
                View All Rooms ({properties.length}) &rarr;
              </Link>
            </div>

            <div className="rt-card-body p-0 flex-grow-1">
              {recentRooms.length === 0 ? (
                <EmptyState
                  icon="bi-door-open"
                  title="No rooms saved yet"
                  description="Locations where you stop during room hunting, or places you save manually, will appear here."
                  actionLabel="Save a Room"
                  actionIcon="bi-plus-lg"
                  onAction={() => setIsQuickAddOpen(true)}
                />
              ) : (
                <div className="list-group list-group-flush">
                  {recentRooms.map((room) => (
                    <div
                      key={room.id}
                      className="list-group-item p-3 border-bottom d-flex justify-content-between align-items-center"
                    >
                      <div className="d-flex align-items-center gap-3">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width: '40px',
                            height: '40px',
                            backgroundColor: room.visited ? '#ecfdf5' : 'var(--rt-blue-50)',
                            color: room.visited ? '#10b981' : 'var(--rt-blue-600)',
                          }}
                        >
                          <i className={`bi ${room.visited ? 'bi-check-lg' : getCategoryIcon(room.category)}`}></i>
                        </div>
                        <div>
                          <div className="fw-semibold text-dark small">{room.name}</div>
                          <div className="text-muted" style={{ fontSize: '0.76rem' }}>
                            {room.address || 'Address recorded'}
                          </div>
                          {room.rent && (
                            <span className="badge bg-light text-dark border small mt-1">
                              {room.rent}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-end flex-shrink-0">
                        <span className={`badge ${room.visited ? 'bg-success' : 'bg-warning text-dark'} small`}>
                          {room.visited ? 'Visited' : 'Pending'}
                        </span>
                        <div className="text-muted mt-1" style={{ fontSize: '0.72rem' }}>
                          {formatDate(room.createdAt || room.visitedAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add Room Modal */}
      <QuickAddPlaceModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={(newRoom) => {
          setProperties((prev) => [newRoom, ...prev]);
        }}
      />
    </div>
  );
};

export default DashboardPage;
