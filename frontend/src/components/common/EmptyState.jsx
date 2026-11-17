import React from 'react';

const EmptyState = ({
  icon = 'bi-inbox',
  title = 'No items found',
  description = 'There are no records to display at this time.',
  actionLabel,
  onAction,
  actionIcon,
}) => {
  return (
    <div className="rt-card text-center p-5 my-3">
      <div
        className="d-inline-flex align-items-center justify-content-center rounded-circle mx-auto mb-3"
        style={{
          width: '64px',
          height: '64px',
          backgroundColor: 'var(--rt-blue-50)',
          color: 'var(--rt-blue-600)',
          fontSize: '1.75rem',
        }}
      >
        <i className={`bi ${icon}`}></i>
      </div>
      <h5 className="fw-bold text-dark mb-1">{title}</h5>
      <p className="text-muted small mx-auto mb-4" style={{ maxWidth: '420px' }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <div>
          <button type="button" className="btn-rt-primary btn-sm" onClick={onAction}>
            {actionIcon && <i className={`bi ${actionIcon}`}></i>}
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
};

export default EmptyState;
