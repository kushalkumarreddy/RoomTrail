import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { isValidEmail, isValidPhone } from '../../utils/validators';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    travelMode: 'car',
    city: 'Bengaluru, India',
    password: '',
    confirmPassword: '',
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const { register } = useAuth();
  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const errors = {};
    if (!formData.fullName.trim()) {
      errors.fullName = 'Full name is required.';
    }
    if (!formData.username.trim()) {
      errors.username = 'Username is required.';
    } else if (formData.username.trim().length < 3) {
      errors.username = 'Username must be at least 3 characters.';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!isValidEmail(formData.email)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (formData.phone && !isValidPhone(formData.phone)) {
      errors.phone = 'Please enter a valid phone number.';
    }

    if (!formData.password) {
      errors.password = 'Password is required.';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const user = await register({
        fullName: formData.fullName,
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        travelMode: formData.travelMode,
        city: formData.city,
        password: formData.password,
      });

      showSuccess(`Account created successfully! Welcome, ${user.fullName}!`);
      navigate('/', { replace: true });
    } catch (err) {
      showError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center p-3 py-5"
      style={{ backgroundColor: 'var(--rt-bg-app)' }}
    >
      <div className="rt-card shadow-lg border-0" style={{ maxWidth: '800px', width: '100%' }}>
        <div className="p-4 p-md-5">
          <div className="text-center mb-4">
            <div className="rt-brand-badge mx-auto mb-2" style={{ width: '42px', height: '42px' }}>
              <i className="bi bi-compass fs-4"></i>
            </div>
            <h3 className="fw-bold text-dark mb-1">Create Your RoomTrail Account</h3>
            <p className="text-muted small">
              Smart destination tracking, duplicate prevention, and route navigation
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="row g-3">
              {/* Full Name */}
              <div className="col-md-6">
                <label className="form-label">Full Name *</label>
                <div className="input-group">
                  <span className="input-group-text bg-white">
                    <i className="bi bi-person text-muted"></i>
                  </span>
                  <input
                    type="text"
                    name="fullName"
                    className={`form-control ${validationErrors.fullName ? 'is-invalid' : ''}`}
                    placeholder="e.g. Alex Morgan"
                    value={formData.fullName}
                    onChange={handleChange}
                  />
                  {validationErrors.fullName && (
                    <div className="invalid-feedback">{validationErrors.fullName}</div>
                  )}
                </div>
              </div>

              {/* Username */}
              <div className="col-md-6">
                <label className="form-label">Username *</label>
                <div className="input-group">
                  <span className="input-group-text bg-white">@</span>
                  <input
                    type="text"
                    name="username"
                    className={`form-control ${validationErrors.username ? 'is-invalid' : ''}`}
                    placeholder="e.g. alex_traveler"
                    value={formData.username}
                    onChange={handleChange}
                  />
                  {validationErrors.username && (
                    <div className="invalid-feedback">{validationErrors.username}</div>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="col-md-6">
                <label className="form-label">Email Address *</label>
                <div className="input-group">
                  <span className="input-group-text bg-white">
                    <i className="bi bi-envelope text-muted"></i>
                  </span>
                  <input
                    type="email"
                    name="email"
                    className={`form-control ${validationErrors.email ? 'is-invalid' : ''}`}
                    placeholder="e.g. alex@example.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                  {validationErrors.email && (
                    <div className="invalid-feedback">{validationErrors.email}</div>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div className="col-md-6">
                <label className="form-label">Phone Number (Optional)</label>
                <div className="input-group">
                  <span className="input-group-text bg-white">
                    <i className="bi bi-telephone text-muted"></i>
                  </span>
                  <input
                    type="tel"
                    name="phone"
                    className={`form-control ${validationErrors.phone ? 'is-invalid' : ''}`}
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                  {validationErrors.phone && (
                    <div className="invalid-feedback">{validationErrors.phone}</div>
                  )}
                </div>
              </div>

              {/* Preferred Travel Mode */}
              <div className="col-md-6">
                <label className="form-label">Primary Travel Mode</label>
                <select
                  name="travelMode"
                  className="form-select"
                  value={formData.travelMode}
                  onChange={handleChange}
                >
                  <option value="walking">Walking (Pedestrian / House Hunting on foot)</option>
                  <option value="bicycle">Bicycle / Two-Wheeler</option>
                  <option value="car">Car / Driving</option>
                  <option value="transit">Public Transit (Bus / Metro)</option>
                </select>
              </div>

              {/* Base City */}
              <div className="col-md-6">
                <label className="form-label">Base City / Search Area</label>
                <input
                  type="text"
                  name="city"
                  className="form-control"
                  placeholder="e.g. Bengaluru, India"
                  value={formData.city}
                  onChange={handleChange}
                />
              </div>

              {/* Password */}
              <div className="col-md-6">
                <label className="form-label">Password *</label>
                <div className="input-group">
                  <span className="input-group-text bg-white">
                    <i className="bi bi-lock text-muted"></i>
                  </span>
                  <input
                    type="password"
                    name="password"
                    className={`form-control ${validationErrors.password ? 'is-invalid' : ''}`}
                    placeholder="At least 6 characters"
                    value={formData.password}
                    onChange={handleChange}
                  />
                  {validationErrors.password && (
                    <div className="invalid-feedback">{validationErrors.password}</div>
                  )}
                </div>
              </div>

              {/* Confirm Password */}
              <div className="col-md-6">
                <label className="form-label">Confirm Password *</label>
                <div className="input-group">
                  <span className="input-group-text bg-white">
                    <i className="bi bi-shield-check text-muted"></i>
                  </span>
                  <input
                    type="password"
                    name="confirmPassword"
                    className={`form-control ${validationErrors.confirmPassword ? 'is-invalid' : ''}`}
                    placeholder="Repeat password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                  {validationErrors.confirmPassword && (
                    <div className="invalid-feedback">{validationErrors.confirmPassword}</div>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn-rt-primary w-100 justify-content-center py-2 mt-4"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  Creating Account...
                </>
              ) : (
                <>
                  <i className="bi bi-person-plus"></i>
                  Create RoomTrail Account
                </>
              )}
            </button>

            <div className="text-center mt-3">
              <span className="text-muted small">Already have an account? </span>
              <Link to="/login" className="fw-semibold text-primary small text-decoration-none">
                Sign In
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
