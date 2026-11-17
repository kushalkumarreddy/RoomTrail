/**
 * Validation utility functions
 */

export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

export const isValidPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  // Allows formats like +1 234 567 8900, +91 9876543210, (555) 123-4567, 10-15 digits
  const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{7,15}$/;
  return phoneRegex.test(phone.trim());
};

export const isValidCoordinate = (lat, lng) => {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  return (
    !isNaN(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    !isNaN(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
};
