import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';

const LoginPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [loginError, setLoginError] = useState(null);
  const [selectedDemo, setSelectedDemo] = useState(null);

  const { login } = useAuth();
  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const validate = () => {
    const errors = {};
    if (!identifier.trim()) {
      errors.identifier = 'Please enter your username.';
    }
    if (!password) {
      errors.password = 'Please enter your password.';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const user = await login({
        identifier: identifier.trim(),
        username: identifier.trim(),
        password: password,
      });

      const userRole = (user?.role || '').toUpperCase();
      const isAdmin = userRole === 'ADMIN' || userRole === 'ROLE_ADMIN';

      showSuccess(`Welcome back, ${user.fullName || user.username}! Logged in as ${isAdmin ? 'Admin' : 'User'}.`);

      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else {
        const targetPath = from === '/login' || from.startsWith('/admin') ? '/' : from;
        navigate(targetPath, { replace: true });
      }
    } catch (err) {
      const errorMsg = err.message || 'Invalid username or password. Please check your credentials.';
      setLoginError(errorMsg);
      showError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectDemoUser = (e) => {
    e.preventDefault();
    setIdentifier('alex_traveler');
    setPassword('password123');
    setSelectedDemo('user');
    setValidationErrors({});
    setLoginError(null);
  };

  const handleSelectDemoAdmin = (e) => {
    e.preventDefault();
    setIdentifier('admink');
    setPassword('admink');
    setSelectedDemo('admin');
    setValidationErrors({});
    setLoginError(null);
  };

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center p-3"
      style={{ backgroundColor: 'var(--rt-bg-app, #f4f7fb)' }}
    >
      <div style={{ maxWidth: '440px', width: '100%' }}>
        <div className="card bg-white border shadow-sm rounded-3 p-4 p-sm-5">
          {/* Header & Branding */}
          <div className="text-center mb-4">
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: 'var(--rt-navy-900, #0b192c)',
                color: '#ffffff',
              }}
            >
              <i className="bi bi-compass fs-4"></i>
            </div>
            <div className="fw-bold fs-5 tracking-tight" style={{ color: 'var(--rt-navy-900, #0b192c)' }}>
              RoomTrail
            </div>
            <h3 className="fw-bold text-dark mt-2 mb-1">Welcome Back</h3>
            <p className="text-muted small mb-0">Sign in to continue to RoomTrail</p>
          </div>

          {/* Login Error Alert */}
          {loginError && (
            <div
              className="alert alert-danger d-flex align-items-center gap-2 py-2 px-3 mb-3 small"
              role="alert"
              id="login-error-alert"
            >
              <i className="bi bi-exclamation-triangle-fill flex-shrink-0 text-danger fs-6"></i>
              <div>{loginError}</div>
            </div>
          )}

          {/* Demo Selection Indicator */}
          {selectedDemo && (
            <div
              className="alert alert-info d-flex align-items-center justify-content-between py-2 px-3 mb-3 small"
              role="status"
              id="demo-selected-indicator"
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-check-circle-fill text-info"></i>
                <span>
                  {selectedDemo === 'admin' ? 'Demo Admin' : 'Demo User'} selected. Click Sign In to continue.
                </span>
              </div>
              <button
                type="button"
                className="btn-close"
                style={{ fontSize: '0.65rem' }}
                onClick={() => setSelectedDemo(null)}
                aria-label="Dismiss indicator"
              ></button>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label className="form-label fw-semibold text-dark small" htmlFor="login-username-input">
                Username
              </label>
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0 text-muted">
                  <i className="bi bi-person"></i>
                </span>
                <input
                  type="text"
                  id="login-username-input"
                  className={`form-control border-start-0 ${
                    validationErrors.identifier ? 'is-invalid' : ''
                  }`}
                  placeholder="Enter username"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setSelectedDemo(null);
                    if (loginError) setLoginError(null);
                  }}
                  autoComplete="username"
                />
                {validationErrors.identifier && (
                  <div className="invalid-feedback d-block">{validationErrors.identifier}</div>
                )}
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold text-dark small" htmlFor="login-password-input">
                Password
              </label>
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0 text-muted">
                  <i className="bi bi-lock"></i>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password-input"
                  className={`form-control border-start-0 border-end-0 ${
                    validationErrors.password ? 'is-invalid' : ''
                  }`}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setSelectedDemo(null);
                    if (loginError) setLoginError(null);
                  }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary border-start-0 text-muted"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
                {validationErrors.password && (
                  <div className="invalid-feedback d-block">{validationErrors.password}</div>
                )}
              </div>
            </div>

            <button
              type="submit"
              id="login-submit-btn"
              className="btn w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 mb-3 text-white"
              style={{
                backgroundColor: 'var(--rt-navy-900, #0b192c)',
                borderColor: 'var(--rt-navy-900, #0b192c)',
              }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right"></i>
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Try a Demo Account Section (Development Mode Only) */}
          {import.meta.env.DEV && (
            <div className="mt-3 pt-3 border-top">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span
                  className="text-muted fw-semibold text-uppercase"
                  style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}
                >
                  Try a demo account
                </span>
                <span
                  className="badge bg-light text-secondary border"
                  style={{ fontSize: '0.62rem' }}
                >
                  DEV ONLY
                </span>
              </div>

              <div className="row g-2">
                {/* Demo User Card */}
                <div className="col-6">
                  <button
                    type="button"
                    className={`card h-100 w-100 p-2 text-start border text-decoration-none ${
                      selectedDemo === 'user'
                        ? 'border-primary bg-primary-subtle shadow-sm'
                        : 'bg-light border-light-subtle'
                    }`}
                    onClick={handleSelectDemoUser}
                    id="demo-user-card-btn"
                    title="Click to fill Demo User credentials"
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <div className="d-flex align-items-center gap-1 text-primary">
                        <i className="bi bi-person-fill fs-6"></i>
                        <strong className="small text-dark">Demo User</strong>
                      </div>
                      <span className="badge bg-primary text-white" style={{ fontSize: '0.58rem' }}>
                        USER
                      </span>
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.68rem', lineHeight: '1.25' }}>
                      Explore RoomTrail as a regular user.
                    </div>
                    <div
                      className="mt-2 pt-1 border-top border-secondary-subtle font-monospace text-secondary"
                      style={{ fontSize: '0.62rem' }}
                    >
                      <div><span className="text-muted">User:</span> alex_traveler</div>
                      <div><span className="text-muted">Pass:</span> password123</div>
                    </div>
                  </button>
                </div>

                {/* Demo Admin Card */}
                <div className="col-6">
                  <button
                    type="button"
                    className={`card h-100 w-100 p-2 text-start border text-decoration-none ${
                      selectedDemo === 'admin'
                        ? 'border-danger bg-danger-subtle shadow-sm'
                        : 'bg-light border-light-subtle'
                    }`}
                    onClick={handleSelectDemoAdmin}
                    id="demo-admin-card-btn"
                    title="Click to fill Demo Admin credentials"
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <div className="d-flex align-items-center gap-1 text-danger">
                        <i className="bi bi-shield-lock-fill fs-6"></i>
                        <strong className="small text-dark">Demo Admin</strong>
                      </div>
                      <span className="badge bg-danger text-white" style={{ fontSize: '0.58rem' }}>
                        ADMIN
                      </span>
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.68rem', lineHeight: '1.25' }}>
                      Explore RoomTrail as an administrator.
                    </div>
                    <div
                      className="mt-2 pt-1 border-top border-secondary-subtle font-monospace text-secondary"
                      style={{ fontSize: '0.62rem' }}
                    >
                      <div><span className="text-muted">User:</span> admink</div>
                      <div><span className="text-muted">Pass:</span> admink</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Registration Link */}
          <div className="text-center mt-3 pt-2">
            <span className="text-muted small">Don't have an account? </span>
            <Link to="/register" className="fw-semibold text-primary small text-decoration-none">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
