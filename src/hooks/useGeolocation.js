import { useState, useCallback, useEffect } from 'react';

/**
 * Custom hook for interfacing with the browser Geolocation API safely
 */
export const useGeolocation = (options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }) => {
  const [coordinates, setCoordinates] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported('geolocation' in navigator);
  }, []);

  const getCurrentPosition = useCallback(() => {
    if (!('geolocation' in navigator)) {
      const err = new Error('Geolocation is not supported by your browser');
      setError(err.message);
      return Promise.reject(err);
    }

    setLoading(true);
    setError(null);

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp,
          };
          setCoordinates(coords);
          setLoading(false);
          resolve(coords);
        },
        (err) => {
          let message = 'Unable to retrieve location';
          if (err.code === err.PERMISSION_DENIED) {
            message = 'Location access permission was denied';
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            message = 'Location position is currently unavailable';
          } else if (err.code === err.TIMEOUT) {
            message = 'Location request timed out';
          }
          setError(message);
          setLoading(false);
          reject(new Error(message));
        },
        options
      );
    });
  }, [options]);

  return {
    coordinates,
    error,
    loading,
    supported,
    getCurrentPosition,
  };
};

export default useGeolocation;
