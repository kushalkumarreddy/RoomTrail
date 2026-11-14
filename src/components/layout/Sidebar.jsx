import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const NAV_ITEMS = [
  {
    path: '/',
    label: 'Dashboard',
    icon: 'bi-grid-1x2',
    end: true,
  },
  {
    path: '/places',
    label: 'Saved Places',
    icon: 'bi-geo-alt',
  },
  {
    path: '/map-explorer',
    label: 'Map Explorer',
    icon: 'bi-map',
  },
  {
    path: '/live-tracking',
    label: 'Live Tracking',
    icon: 'bi-broadcast',
  },
  {
    path: '/trips',
    label: 'My Trips',
    icon: 'bi-signpost-split',
  },
  {
    path: '/history',
    label: 'Visit History',
    icon: 'bi-clock-history',
  },
  {
    path: '/travel-history-map',
    label: 'Travel History Map',
    icon: 'bi-signpost-2',
  },
  {
    path: '/trip-summary',
    label: 'Trip Summary',
    icon: 'bi-bar-chart',
  },
];

const Sidebar = ({ isCollapsed, isMobileOpen, onCloseMobile }) => {
  const { user } = useAuth();

  const getTravelModeIcon = (mode) => {
    switch (mode) {
      case 'walking':
        return 'bi-person-walking';
      case 'bicycle':
        return 'bi-bicycle';
      case 'transit':
        return 'bi-bus-front';
      case 'car':
      default:
        return 'bi-car-front';
    }
  };

  return (
    <aside
      className={`rt-sidebar ${isCollapsed ? 'rt-sidebar-collapsed' : ''} ${
        isMobileOpen ? 'mobile-open' : ''
      }`}
    >
      <div className="rt-sidebar-inner">
        {/* Navigation Section */}
        <div className="rt-nav-section-title">
          {!isCollapsed ? 'Navigation' : '•••'}
        </div>

        <nav className="d-flex flex-column mb-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `rt-nav-item ${isActive ? 'active' : ''}`
              }
              onClick={onCloseMobile}
              title={isCollapsed ? item.label : undefined}
            >
              <i className={`bi ${item.icon}`}></i>
              {!isCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User Preferences / Travel Mode Quick Card */}
        {user && !isCollapsed && (
          <div
            className="p-3 mt-3 rounded border"
            style={{ backgroundColor: 'var(--rt-blue-50)', borderColor: 'rgba(0, 141, 218, 0.2)' }}
          >
            <div className="d-flex align-items-center gap-2 mb-2">
              <i className={`bi ${getTravelModeIcon(user.travelMode)} text-primary fs-5`}></i>
              <div>
                <div className="fw-bold small text-dark text-capitalize">
                  {user.travelMode || 'Car'} Mode
                </div>
                <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                  Proximity: {user.notificationRadiusMeters || 100}m
                </div>
              </div>
            </div>
            <div className="text-muted" style={{ fontSize: '0.72rem' }}>
              Base: <span className="fw-semibold text-dark">{user.city || 'Set Location'}</span>
            </div>
          </div>
        )}

        {/* Footer links inside sidebar */}
        <div className="pt-3 mt-3 border-top">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `rt-nav-item ${isActive ? 'active' : ''}`
            }
            onClick={onCloseMobile}
            title={isCollapsed ? 'Profile & Settings' : undefined}
          >
            <i className="bi bi-gear"></i>
            {!isCollapsed && <span>User Profile</span>}
          </NavLink>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
