import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center p-3 text-center"
      style={{ backgroundColor: 'var(--rt-bg-app)' }}
    >
      <div className="rt-card p-5 shadow-lg border-0" style={{ maxWidth: '480px', width: '100%' }}>
        <div
          className="d-inline-flex align-items-center justify-content-center rounded-circle mx-auto mb-3"
          style={{
            width: '80px',
            height: '80px',
            backgroundColor: 'var(--rt-blue-50)',
            color: 'var(--rt-navy-900)',
            fontSize: '2.5rem',
          }}
        >
          <i className="bi bi-compass"></i>
        </div>
        <h1 className="fw-bold display-4 text-dark mb-1">404</h1>
        <h5 className="fw-bold text-secondary mb-2">Location Not Found</h5>
        <p className="text-muted small mb-4">
          The trail or page you are looking for does not exist or has been moved to another coordinate.
        </p>
        <Link to="/" className="btn-rt-primary w-100 justify-content-center py-2">
          <i className="bi bi-house-door"></i>
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
