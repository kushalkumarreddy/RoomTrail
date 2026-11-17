/**
 * RoomTrail Google Maps Navigation Utilities
 *
 * Objective:
 * Construct direct Google Maps navigation and search URLs for saved rooms.
 *
 * URL construction specifications:
 * 1. When valid latitude and longitude are available:
 *    https://www.google.com/maps/search/?api=1&query=LATITUDE,LONGITUDE
 *    Example: https://www.google.com/maps/search/?api=1&query=17.3850,78.4867
 *
 * 2. When coordinates are unavailable:
 *    Fallback to full address as search query:
 *    https://www.google.com/maps/search/?api=1&query=ENCODED_ADDRESS
 *
 * 3. When neither coordinates nor usable address exists:
 *    Return null (so UI can show a helpful warning instead of opening an incorrect location).
 */

export const getGoogleMapsUrl = (place) => {
  if (!place) return null;

  // Extract latitude and longitude (supporting both direct and nested coordinates)
  const lat = place.latitude ?? place.lat ?? place.visitLat ?? place.visitCoordinates?.lat;
  const lng = place.longitude ?? place.lng ?? place.visitLng ?? place.visitCoordinates?.lng;

  const numLat = lat !== null && lat !== undefined && lat !== '' ? Number(lat) : NaN;
  const numLng = lng !== null && lng !== undefined && lng !== '' ? Number(lng) : NaN;

  // Check for valid numeric coordinates
  if (!isNaN(numLat) && !isNaN(numLng) && (numLat !== 0 || numLng !== 0)) {
    return `https://www.google.com/maps/search/?api=1&query=${numLat},${numLng}`;
  }

  // Fallback to address
  const rawAddress = (place.address || '').trim();
  const rawCity = (place.city || '').trim();

  const invalidPlaceholders = [
    'address not specified',
    'address not set',
    'not specified',
    'address recorded',
    'coordinates recorded',
  ];

  const addressValid = rawAddress && !invalidPlaceholders.includes(rawAddress.toLowerCase());
  const cityValid = rawCity && !invalidPlaceholders.includes(rawCity.toLowerCase());

  if (addressValid || cityValid) {
    const parts = [];
    if (addressValid) parts.push(rawAddress);
    if (cityValid && (!addressValid || !rawAddress.toLowerCase().includes(rawCity.toLowerCase()))) {
      parts.push(rawCity);
    }
    const fullQuery = parts.join(', ').trim();
    if (fullQuery) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullQuery)}`;
    }
  }

  return null;
};

/**
 * Programmatically opens Google Maps in a new browser tab.
 * If coordinates/address are missing, executes onMissing callback or returns false.
 */
export const openLocationInGoogleMaps = (place, onMissing) => {
  const url = getGoogleMapsUrl(place);
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }
  if (typeof onMissing === 'function') {
    onMissing();
  }
  return false;
};
