import React from 'react';

const Badge = ({ variant = 'primary', icon, children, className = '' }) => {
  let badgeClass = 'badge-rt-primary';
  if (variant === 'success') badgeClass = 'badge-rt-success';
  if (variant === 'warning') badgeClass = 'badge-rt-warning';
  if (variant === 'danger') badgeClass = 'badge-rt-danger';
  if (variant === 'navy') badgeClass = 'badge-rt-navy';

  return (
    <span className={`badge-rt ${badgeClass} ${className}`}>
      {icon && <i className={`bi ${icon}`}></i>}
      {children}
    </span>
  );
};

export default Badge;
