import React from 'react';
import { getGoogleMapsUrl } from '../../utils/googleMaps';

/**
 * GoogleMapsLocationLink
 *
 * Clickable location/address component that opens Google Maps in a new tab.
 * When coordinates exist: query=LAT,LNG
 * When coordinates missing: query=FULL_ADDRESS
 * When neither exists: shows a helpful toast/alert message without navigating.
 */
const GoogleMapsLocationLink = ({
  place,
  address,
  city,
  latitude,
  longitude,
  className = '',
  style = {},
  variant = 'link', // 'link', 'button', 'badge', 'icon'
  btnSize = 'sm',
  showExternalIcon = true,
  onMissingLocation,
  children,
}) => {
  // Construct normalized place object
  const normalizedPlace = place || {
    address,
    city,
    latitude,
    longitude,
  };

  const gmapsUrl = getGoogleMapsUrl(normalizedPlace);

  // Compute display address if no children provided
  const displayAddress =
    children ||
    [normalizedPlace.address, normalizedPlace.city]
      .filter(Boolean)
      .join(', ')
      .trim() ||
    'Address not specified';

  const handleClick = (e) => {
    e.stopPropagation();

    if (!gmapsUrl) {
      e.preventDefault();
      if (typeof onMissingLocation === 'function') {
        onMissingLocation(normalizedPlace);
      } else {
        alert(
          'Location information (coordinates or address) is not available for Google Maps navigation.'
        );
      }
    }
  };

  const accessibleTitle = gmapsUrl
    ? 'Open location in Google Maps'
    : 'Location coordinates or address not available for Google Maps';

  if (variant === 'button') {
    return (
      <a
        href={gmapsUrl || '#'}
        target={gmapsUrl ? '_blank' : undefined}
        rel={gmapsUrl ? 'noopener noreferrer' : undefined}
        onClick={handleClick}
        className={`btn btn-${btnSize} btn-outline-danger d-inline-flex align-items-center gap-1 ${className}`}
        style={{ textDecoration: 'none', cursor: gmapsUrl ? 'pointer' : 'not-allowed', ...style }}
        title={accessibleTitle}
        aria-label="Open location in Google Maps"
        id={`gmaps-btn-${place?.id || 'link'}`}
      >
        <i className="bi bi-geo-alt-fill text-danger"></i>
        <span>{children || 'Open in Google Maps'}</span>
        {showExternalIcon && <i className="bi bi-box-arrow-up-right ms-1" style={{ fontSize: '0.72rem' }}></i>}
      </a>
    );
  }

  if (variant === 'badge') {
    return (
      <a
        href={gmapsUrl || '#'}
        target={gmapsUrl ? '_blank' : undefined}
        rel={gmapsUrl ? 'noopener noreferrer' : undefined}
        onClick={handleClick}
        className={`badge bg-light text-primary border d-inline-flex align-items-center gap-1 text-decoration-none shadow-sm ${className}`}
        style={{
          cursor: gmapsUrl ? 'pointer' : 'default',
          transition: 'all 0.15s ease-in-out',
          ...style,
        }}
        title={accessibleTitle}
        aria-label="Open location in Google Maps"
        id={`gmaps-badge-${place?.id || 'link'}`}
      >
        <i className="bi bi-geo-alt-fill text-danger"></i>
        <span>{children || 'Google Maps'}</span>
        {showExternalIcon && <i className="bi bi-box-arrow-up-right ms-1" style={{ fontSize: '0.65rem' }}></i>}
      </a>
    );
  }

  // Default 'link' variant
  return (
    <a
      href={gmapsUrl || '#'}
      target={gmapsUrl ? '_blank' : undefined}
      rel={gmapsUrl ? 'noopener noreferrer' : undefined}
      onClick={handleClick}
      className={`rt-location-link d-inline-flex align-items-center text-decoration-none text-muted ${className}`}
      style={{
        cursor: gmapsUrl ? 'pointer' : 'default',
        maxWidth: '100%',
        ...style,
      }}
      title={accessibleTitle}
      aria-label="Open location in Google Maps"
      id={`gmaps-link-${place?.id || 'link'}`}
    >
      <i className="bi bi-geo-alt-fill text-danger me-1 flex-shrink-0" title="Google Maps Navigation"></i>
      <span className="rt-location-link-text text-truncate">
        {displayAddress}
      </span>
      {showExternalIcon && gmapsUrl && (
        <i
          className="bi bi-box-arrow-up-right ms-1 text-primary flex-shrink-0 rt-location-link-ext"
          style={{ fontSize: '0.7rem' }}
          title="Opens in Google Maps"
        ></i>
      )}
    </a>
  );
};

export default GoogleMapsLocationLink;
