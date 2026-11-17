import React from 'react';

const LoadingSpinner = ({ text = 'Loading RoomTrail...', fullPage = false, size = 'normal' }) => {
  const spinnerSizeClass = size === 'small' ? 'spinner-border-sm' : '';

  const content = (
    <div className="d-flex flex-column align-items-center justify-content-center p-4">
      <div
        className={`spinner-border text-primary ${spinnerSizeClass}`}
        role="status"
        style={{ color: 'var(--rt-blue-500)' }}
      >
        <span className="visually-hidden">Loading...</span>
      </div>
      {text && <p className="mt-3 text-muted mb-0 small fw-medium">{text}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div
        className="d-flex align-items-center justify-content-center"
        style={{ minHeight: '60vh' }}
      >
        {content}
      </div>
    );
  }

  return content;
};

export default LoadingSpinner;
