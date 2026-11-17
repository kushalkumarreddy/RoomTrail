import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';

const Navbar = ({ onToggleSidebar, onToggleMobileSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [serverOnline, setServerOnline] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    // Check Spring Boot backend health periodically
    const checkServer = async () => {
      const isHealthy = await authService.checkHealth();
      setServerOnline(isHealthy);
    };

    checkServer();
    const interval = setInterval(checkServer, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userRole = (user?.role || '').toUpperCase();
  const isAdmin = userRole === 'ADMIN' || userRole === 'ROLE_ADMIN';

  const getInitials = (name) => {
    if (!name) return 'RT';
    return name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <header className="rt-navbar">
      <div className="d-flex align-items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          type="button"
          className="btn btn-rt-ghost d-lg-none text-white p-2"
          onClick={onToggleMobileSidebar}
          aria-label="Toggle navigation menu"
        >
          <i className="bi bi-list fs-4"></i>
        </button>

        {/* Desktop collapse toggle */}
        <button
          type="button"
          className="btn btn-rt-ghost d-none d-lg-flex text-white p-2"
          onClick={onToggleSidebar}
          aria-label="Collapse sidebar"
        >
          <i className="bi bi-layout-sidebar-inset fs-5"></i>
        </button>

        {/* Brand link */}
        <Link to={isAdmin ? '/admin' : '/'} className="rt-brand">
          <div className="rt-brand-badge">
            <i className="bi bi-compass"></i>
          </div>
          <span className="d-none d-sm-inline">Room<span style={{ color: 'var(--rt-blue-400)' }}>Trail</span></span>
        </Link>
      </div>

      {/* Middle Status & Info */}
      <div className="d-none d-md-flex align-items-center ms-4">
        <span
          className={`badge rounded-pill ${
            serverOnline ? 'bg-success-subtle text-success border border-success' : 'bg-danger-subtle text-danger border border-danger'
          } small px-2 py-1 d-inline-flex align-items-center gap-1`}
          style={{ fontSize: '0.75rem' }}
        >
          <span
            className={`d-inline-block rounded-circle ${
              serverOnline ? 'bg-success' : 'bg-danger'
            }`}
            style={{ width: '6px', height: '6px' }}
          ></span>
          {serverOnline ? 'API Connected' : 'API Offline'}
        </span>
      </div>

      {/* Right User Actions */}
      <div className="ms-auto d-flex align-items-center gap-2">
        {user ? (
          <div className="position-relative">
            <button
              type="button"
              className="btn d-flex align-items-center gap-2 p-1 text-white border-0"
              onClick={() => setShowDropdown((prev) => !prev)}
              aria-expanded={showDropdown}
              id="navbar-user-dropdown-btn"
            >
              <div className="rt-avatar" style={{ backgroundColor: isAdmin ? '#dc2626' : undefined }}>
                {getInitials(user.fullName || user.username)}
              </div>
              <div className="text-start d-none d-sm-block">
                <div className="fw-semibold small leading-none d-flex align-items-center gap-1">
                  <span>{user.fullName || user.username}</span>
                  <span
                    className={`badge ${
                      isAdmin
                        ? 'bg-danger text-white'
                        : 'bg-primary text-white'
                    } fw-bold`}
                    style={{ fontSize: '0.62rem', padding: '2px 5px' }}
                  >
                    {isAdmin ? 'ADMIN' : 'USER'}
                  </span>
                </div>
                <div className="text-white-50 small" style={{ fontSize: '0.72rem' }}>
                  {isAdmin ? 'Administrator' : (user.city || 'Explorer')}
                </div>
              </div>
              <i className="bi bi-chevron-down text-white-50 small ms-1"></i>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <>
                <div
                  className="position-fixed top-0 start-0 w-100 h-100"
                  style={{ zIndex: 1045 }}
                  onClick={() => setShowDropdown(false)}
                />
                <div
                  className="dropdown-menu dropdown-menu-end show position-absolute mt-2 shadow-lg border"
                  style={{
                    right: 0,
                    top: '100%',
                    minWidth: '220px',
                    zIndex: 1050,
                    borderRadius: 'var(--rt-border-radius-md)',
                  }}
                  id="navbar-user-dropdown-menu"
                >
                  <div className="px-3 py-2 border-bottom">
                    <p className="mb-0 fw-semibold text-dark small d-flex align-items-center gap-1">
                      <span>{user.fullName || user.username}</span>
                      <span className={`badge ${isAdmin ? 'bg-danger' : 'bg-primary'} text-white small`} style={{ fontSize: '0.6rem' }}>
                        {isAdmin ? 'ADMIN' : 'USER'}
                      </span>
                    </p>
                    <p className="mb-0 text-muted small text-truncate">{user.email}</p>
                  </div>
                  {isAdmin ? (
                    <Link
                      to="/admin"
                      className="dropdown-item py-2 d-flex align-items-center gap-2 small"
                      onClick={() => setShowDropdown(false)}
                      id="navbar-admin-console-link"
                    >
                      <i className="bi bi-speedometer2 text-danger"></i>
                      Admin Dashboard
                    </Link>
                  ) : (
                    <Link
                      to="/profile"
                      className="dropdown-item py-2 d-flex align-items-center gap-2 small"
                      onClick={() => setShowDropdown(false)}
                      id="navbar-user-profile-link"
                    >
                      <i className="bi bi-person text-primary"></i>
                      User Profile
                    </Link>
                  )}
                  <Link
                    to="/landing"
                    className="dropdown-item py-2 d-flex align-items-center gap-2 small"
                    onClick={() => setShowDropdown(false)}
                  >
                    <i className="bi bi-info-circle text-secondary"></i>
                    About RoomTrail
                  </Link>
                  <div className="dropdown-divider my-1"></div>
                  <button
                    type="button"
                    className="dropdown-item py-2 d-flex align-items-center gap-2 text-danger small"
                    onClick={() => {
                      setShowDropdown(false);
                      handleLogout();
                    }}
                    id="navbar-sign-out-btn"
                  >
                    <i className="bi bi-box-arrow-right"></i>
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="d-flex align-items-center gap-2">
            <Link to="/login" className="btn btn-sm btn-outline-light">
              Sign In
            </Link>
            <Link to="/register" className="btn btn-sm btn-rt-accent">
              Get Started
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
