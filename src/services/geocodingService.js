import axios from 'axios';
import apiClient from './api';
import { isValidCoordinate } from '../utils/validators';

/**
 * OpenStreetMap Nominatim Base URL
 */
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

/**
 * Service for reverse geocoding, place name auto-detection, and location address auto-fill
 * Fully implements Phase 9 requirements.
 */
export const geocodingService = {
  /**
   * Perform reverse geocoding for a given coordinate pair
   * @param {Object} params
   * @param {number|string} params.latitude
   * @param {number|string} params.longitude
   * @returns {Promise<Object>} Formatted location details and suggestions
   */
  reverseGeocode: async ({ latitude, longitude }) => {
    if (!isValidCoordinate(latitude, longitude)) {
      return {
        success: false,
        latitude,
        longitude,
        hasRecognizedName: false,
        placeName: '',
        address: '',
        city: '',
        suggestions: [],
        error: 'Invalid coordinates provided for reverse geocoding.',
      };
    }

    const lat = Number(Number(latitude).toFixed(6));
    const lng = Number(Number(longitude).toFixed(6));

    let rawData = null;

    // Strategy 1: Attempt direct OpenStreetMap Nominatim reverse geocode
    try {
      const response = await axios.get(
        `${NOMINATIM_REVERSE_URL}?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
        {
          timeout: 6000,
          headers: {
            Accept: 'application/json',
          },
        }
      );
      if (response?.data && !response.data.error) {
        rawData = response.data;
      }
    } catch (directErr) {
      // Nominatim direct request failed or was blocked by browser/rate-limit; fallback to backend proxy
      console.warn('Direct Nominatim request failed, trying RoomTrail backend proxy...', directErr.message);
    }

    // Strategy 2: Fallback to RoomTrail Spring Boot backend proxy endpoint
    if (!rawData) {
      try {
        const proxyResponse = await apiClient.get('/geocode/reverse', {
          params: { lat, lon: lng },
          timeout: 8000,
        });
        if (proxyResponse?.data && !proxyResponse.data.error) {
          rawData = proxyResponse.data;
        } else if (proxyResponse?.data?.error) {
          return {
            success: false,
            latitude: lat,
            longitude: lng,
            hasRecognizedName: false,
            placeName: '',
            address: '',
            city: '',
            suggestions: [],
            error: proxyResponse.data.error,
          };
        }
      } catch (proxyErr) {
        console.warn('Backend geocoding proxy also failed:', proxyErr.message);
      }
    }

    // If both failed, return graceful degraded response
    if (!rawData) {
      return {
        success: false,
        latitude: lat,
        longitude: lng,
        hasRecognizedName: false,
        placeName: '',
        address: '',
        city: '',
        suggestions: [],
        error: 'Unable to connect to location services. You can enter details manually.',
      };
    }

    // Extract address details safely
    const address = rawData.address || {};

    // 1. POI / Venue Name Detection
    let recognizedName = '';
    if (
      rawData.name &&
      typeof rawData.name === 'string' &&
      rawData.name.trim() &&
      !/^\d+$/.test(rawData.name.trim())
    ) {
      recognizedName = rawData.name.trim();
    } else if (address.amenity) {
      recognizedName = address.amenity;
    } else if (address.building && address.building !== 'yes') {
      recognizedName = address.building;
    } else if (address.shop) {
      recognizedName = address.shop;
    } else if (address.tourism) {
      recognizedName = address.tourism;
    } else if (address.leisure) {
      recognizedName = address.leisure;
    } else if (address.office) {
      recognizedName = address.office;
    } else if (address.commercial) {
      recognizedName = address.commercial;
    } else if (address.historic) {
      recognizedName = address.historic;
    } else if (address.club) {
      recognizedName = address.club;
    }

    const hasRecognizedName = Boolean(recognizedName);

    // 2. Generate intelligent locality and road suggestions
    const road = address.road || address.pedestrian || address.street || address.footway || '';
    const locality =
      address.suburb ||
      address.neighbourhood ||
      address.quarter ||
      address.residential ||
      address.village ||
      '';
    const cityDistrict = address.city_district || address.county || '';

    const suggestionList = [];
    if (road) suggestionList.push(`Near ${road}`);
    if (locality) suggestionList.push(locality);
    if (road && locality) suggestionList.push(`${road} Area`);
    if (locality && cityDistrict && locality !== cityDistrict) {
      suggestionList.push(`${locality}, ${cityDistrict}`);
    }
    if (cityDistrict && !suggestionList.includes(cityDistrict)) {
      suggestionList.push(cityDistrict);
    }

    const suggestions = [...new Set(suggestionList)].filter((s) => s && s.length > 2);

    // 3. Format Street Address
    const streetParts = [
      address.house_number ? `#${address.house_number}` : null,
      address.building && address.building !== 'yes' && address.building !== recognizedName
        ? address.building
        : null,
      road,
      address.neighbourhood,
      address.quarter && address.quarter !== address.neighbourhood ? address.quarter : null,
      address.suburb && address.suburb !== address.neighbourhood ? address.suburb : null,
      address.postcode,
    ].filter(Boolean);

    let formattedAddress = streetParts.length > 0 ? streetParts.join(', ') : '';
    if (!formattedAddress && rawData.display_name) {
      const parts = rawData.display_name.split(', ');
      formattedAddress = parts.slice(0, Math.min(parts.length, 4)).join(', ');
    }

    // 4. Format City / Region
    const cityName =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.city_district ||
      address.county ||
      '';
    const stateOrCountry = address.state || address.country || '';
    const formattedCity = [cityName, stateOrCountry].filter(Boolean).join(', ') || 'Bengaluru, India';

    // 5. Category inference
    let recommendedCategory = null;
    const amenityLower = (address.amenity || '').toLowerCase();
    const typeLower = (rawData.type || '').toLowerCase();
    const buildingLower = (address.building || '').toLowerCase();

    if (
      amenityLower.includes('school') ||
      amenityLower.includes('college') ||
      amenityLower.includes('hospital') ||
      amenityLower.includes('restaurant') ||
      amenityLower.includes('cafe') ||
      address.tourism ||
      address.historic
    ) {
      recommendedCategory = 'travel';
    } else if (buildingLower.includes('apartment') || buildingLower.includes('residential')) {
      recommendedCategory = 'flat';
    } else if (amenityLower.includes('hostel') || amenityLower.includes('dormitory')) {
      recommendedCategory = 'pg';
    }

    return {
      success: true,
      latitude: lat,
      longitude: lng,
      hasRecognizedName,
      placeName: recognizedName,
      address: formattedAddress,
      city: formattedCity,
      suggestions,
      category: recommendedCategory,
      displayName: rawData.display_name,
      raw: rawData,
    };
  },
};

export default geocodingService;
