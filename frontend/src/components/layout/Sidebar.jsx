import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const USER_NAV_ITEMS = [
  {
    path: '/',
    label: 'Dashboard',
    icon: 'bi-grid-1x2',
    end: true,
  },
  {
    path: '/live-tracking',
    label: 'Live Tracking',
    icon: 'bi-broadcast',
  },
  {
    path: '/rooms',
    label: 'Saved Rooms',
    icon: 'bi-door-open',
  },
  {
    path: '/history',
    label: 'Travel History',
    icon: 'bi-clock-history',
  },
];

const ADMIN_NAV_ITEMS = [
  {
    path: '/admin',
    label: 'Admin Dashboard',
    icon: 'bi-speedometer2',
    end: true,
  },
  {
    path: '/admin/users',
    label: 'Registered Users',
    icon: 'bi-people',
  },
  {
    path: '/admin/platform',
    label: 'Platform Overview',
    icon: 'bi-bar-chart-line',
  },
  {
    path: '/admin/profile',
    label: 'Admin Profile',
    icon: 'bi-shield-lock',
  },
];

const Sidebar = ({ isCollapsed, isMobileOpen, onCloseMobile }) => {
  const { user } = useAuth();

  const userRole = (user?.role || '').toUpperCase();
  const isAdmin = userRole === 'ADMIN' || userRole === 'ROLE_ADMIN';
  const navItems = isAdmin ? ADMIN_NAV_ITEMS : USER_NAV_ITEMS;

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
          {!isCollapsed ? (isAdmin ? 'Admin Menu' : 'Navigation') : '•••'}
        </div>

        <nav className="d-flex flex-column mb-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `rt-nav-item ${isActive ? 'active' : ''}`
              }
              onClick={onCloseMobile}
              title={isCollapsed ? item.label : undefined}
              id={`nav-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <i className={`bi ${item.icon}`}></i>
              {!isCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Administrator Role Badge Card */}
        {user && !isCollapsed && isAdmin && (
          <div
            className="p-3 mt-3 rounded border"
            style={{ backgroundColor: '#fef2f2', borderColor: 'rgba(239, 68, 68, 0.25)' }}
            id="sidebar-admin-role-card"
          >
            <div className="d-flex align-items-center gap-2 mb-1">
              <i className="bi bi-shield-lock-fill text-danger fs-5"></i>
              <div>
                <div className="fw-bold small text-dark">Administrator</div>
                <div className="text-muted" style={{ fontSize: '0.72rem' }}>Role: ADMIN</div>
              </div>
            </div>
            <div className="text-muted" style={{ fontSize: '0.72rem' }}>
              Account: <span className="fw-semibold text-dark">{user.username}</span>
            </div>
          </div>
        )}

        {/* User Preferences / Travel Mode Quick Card */}
        {user && !isCollapsed && !isAdmin && (
          <div
            className="p-3 mt-3 rounded border"
            style={{ backgroundColor: 'var(--rt-blue-50)', borderColor: 'rgba(0, 141, 218, 0.2)' }}
            id="sidebar-user-role-card"
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
          <div className="d-flex align-items-center justify-content-between text-muted" style={{ fontSize: '0.72rem' }}>
            {!isCollapsed && <span>RoomTrail Platform</span>}
            <span className="badge bg-light text-secondary border">v2.1</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
