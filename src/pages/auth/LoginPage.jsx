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

  const { login } = useAuth();
  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const validate = () => {
    const errors = {};
    if (!identifier.trim()) {
      errors.identifier = 'Please enter your email or username.';
    }
    if (!password) {
      errors.password = 'Please enter your password.';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const user = await login({ identifier, password });
      showSuccess(`Welcome back, ${user.fullName || user.username}!`);
      navigate(from, { replace: true });
    } catch (err) {
      showError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemoFill = () => {
    setIdentifier('alex@roomtrail.com');
    setPassword('password123');
    setValidationErrors({});
  };

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center p-3"
      style={{ backgroundColor: 'var(--rt-bg-app)' }}
    >
      <div className="rt-card shadow-lg border-0" style={{ maxWidth: '940px', width: '100%' }}>
        <div className="row g-0">
          {/* Left Hero Column */}
          <div
            className="col-lg-5 d-none d-lg-flex flex-column justify-content-between p-5 text-white"
            style={{
              background: 'linear-gradient(135deg, var(--rt-navy-900) 0%, var(--rt-navy-700) 100%)',
            }}
          >
            <div>
              <div className="d-flex align-items-center gap-2 mb-4">
                <div className="rt-brand-badge">
                  <i className="bi bi-compass"></i>
                </div>
                <h4 className="fw-bold mb-0 text-white">RoomTrail</h4>
              </div>
              <h3 className="fw-bold mb-3" style={{ lineHeight: '1.3' }}>
                Never lose track of your rental visits or travel routes.
              </h3>
              <p className="text-white-50 small mb-4">
                Smart location discovery, proximity detection, duplicate visit prevention, and road route recording for flats, PGs, and general travel.
              </p>
            </div>

            <div className="pt-4 border-top border-white-50">
              <div className="d-flex align-items-center gap-3">
                <i className="bi bi-geo-alt-fill fs-3 text-info"></i>
                <div>
                  <div className="small fw-semibold text-white">Live Route & Destination Engine</div>
                  <div className="text-white-50" style={{ fontSize: '0.75rem' }}>
                    OpenStreetMap, Leaflet & GPS Proximity
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Form Column */}
          <div className="col-lg-7 p-4 p-md-5">
            <div className="d-flex align-items-center justify-content-between mb-4">
              <div>
                <h3 className="fw-bold text-dark mb-1">Sign In</h3>
                <p className="text-muted small mb-0">Access your saved destinations and trips</p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                onClick={handleQuickDemoFill}
                title="Fill with Alex Morgan demo credentials"
              >
                <i className="bi bi-lightning-charge"></i>
                Demo Fill
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-3">
                <label className="form-label">Email or Username</label>
                <div className="input-group">
                  <span className="input-group-text bg-white border-end-0">
                    <i className="bi bi-person text-muted"></i>
                  </span>
                  <input
                    type="text"
                    className={`form-control border-start-0 ${
                      validationErrors.identifier ? 'is-invalid' : ''
                    }`}
                    placeholder="e.g. alex@roomtrail.com"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    autoComplete="username"
                  />
                  {validationErrors.identifier && (
                    <div className="invalid-feedback d-block">{validationErrors.identifier}</div>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label mb-0">Password</label>
                </div>
                <div className="input-group">
                  <span className="input-group-text bg-white border-end-0">
                    <i className="bi bi-lock text-muted"></i>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`form-control border-start-0 border-end-0 ${
                      validationErrors.password ? 'is-invalid' : ''
                    }`}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary border-start-0"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                className="btn-rt-primary w-100 justify-content-center py-2 mb-3"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    Authenticating...
                  </>
                ) : (
                  <>
                    <i className="bi bi-box-arrow-in-right"></i>
                    Sign In to RoomTrail
                  </>
                )}
              </button>

              <div className="text-center mt-3">
                <span className="text-muted small">Don't have an account? </span>
                <Link to="/register" className="fw-semibold text-primary small text-decoration-none">
                  Create an account
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
