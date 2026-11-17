import apiClient from './api';

/**
 * Service for managing Properties / Saved Destinations (PGs, Flats, Rooms, Houses, Travel spots)
 * Strictly conforms to Phase 3 Property Fields:
 * - id, userId, name, category, address, latitude, longitude, description,
 *   priority, contactDetails, price, facilities, visitStatus, createdDate
 */
export const propertyService = {
  /**
   * Fetch all properties with optional query filters
   */
  getAll: async (params = {}) => {
    const response = await apiClient.get('/properties', { params });
    const properties = response.data || [];
    return properties.map(propertyService.normalize);
  },

  /**
   * Fetch a single property by ID
   */
  getById: async (id) => {
    const response = await apiClient.get(`/properties/${id}`);
    return propertyService.normalize(response.data);
  },

  /**
   * Filter properties by category
   */
  getByCategory: async (category) => {
    const response = await apiClient.get('/properties', {
      params: { category: category.toLowerCase() },
    });
    return (response.data || []).map(propertyService.normalize);
  },

  /**
   * Create a new saved property / destination
   */
  create: async (data) => {
    const now = new Date().toISOString();
    const isVisited = Boolean(data.visitStatus === 'visited' || data.visited === true);

    const payload = {
      id: data.id || String(Date.now()),
      userId: data.userId || '1',
      name: data.name ? data.name.trim() : 'Unnamed Destination',
      category: (data.category || 'flat').toLowerCase(),
      address: data.address ? data.address.trim() : '',
      city: data.city || 'Hyderabad',
      latitude: data.latitude !== null && data.latitude !== undefined && data.latitude !== '' ? parseFloat(data.latitude) : null,
      longitude: data.longitude !== null && data.longitude !== undefined && data.longitude !== '' ? parseFloat(data.longitude) : null,
      description: data.description || data.notes || '',
      notes: data.notes || data.description || '',
      priority: (data.priority || 'medium').toLowerCase(),
      contactDetails: data.contactDetails || (data.contactPhone ? `${data.contactPerson || 'Contact'}: ${data.contactPhone}` : ''),
      contactPerson: data.contactPerson || '',
      contactPhone: data.contactPhone || '',
      price: data.price || data.rent || '',
      rent: data.rent || data.price || '',
      facilities: Array.isArray(data.facilities) ? data.facilities : (Array.isArray(data.amenities) ? data.amenities : []),
      amenities: Array.isArray(data.amenities) ? data.amenities : (Array.isArray(data.facilities) ? data.facilities : []),
      visitStatus: isVisited ? 'visited' : 'pending',
      visited: isVisited,
      createdDate: data.createdDate || data.createdAt || now,
      createdAt: data.createdAt || data.createdDate || now,
      updatedAt: now,
    };

    const response = await apiClient.post('/properties', payload);
    return propertyService.normalize(response.data);
  },

  /**
   * Update an existing property
   */
  update: async (id, data) => {
    const now = new Date().toISOString();
    const isVisited = data.visitStatus !== undefined
      ? data.visitStatus === 'visited'
      : (data.visited !== undefined ? Boolean(data.visited) : undefined);

    const payload = {
      ...data,
      ...(isVisited !== undefined && {
        visitStatus: isVisited ? 'visited' : 'pending',
        visited: isVisited,
      }),
      ...(data.description && { notes: data.description }),
      ...(data.notes && { description: data.notes }),
      ...(data.price && { rent: data.price }),
      ...(data.rent && { price: data.rent }),
      ...(data.facilities && { amenities: data.facilities }),
      ...(data.amenities && { facilities: data.amenities }),
      updatedAt: now,
    };

    const response = await apiClient.patch(`/properties/${id}`, payload);
    return propertyService.normalize(response.data);
  },

  /**
   * Update personal notes for a visited location / property
   */
  updateNotes: async (id, notes) => {
    const payload = { notes: notes !== null && notes !== undefined ? notes : '' };
    const response = await apiClient.patch(`/properties/${id}/notes`, payload);
    return propertyService.normalize(response.data);
  },

  /**
   * Mark or remove a property as favourite (Phase 3)
   */
  toggleFavorite: async (id, favorite = null) => {
    const payload = favorite !== null ? { favorite } : {};
    const response = await apiClient.patch(`/properties/${id}/favorite`, payload);
    return response.data;
  },

  /**
   * Fetch all favourite properties for the authenticated user (Phase 3)
   */
  getFavorites: async () => {
    const response = await apiClient.get('/properties/favorites');
    const properties = response.data || [];
    return properties.map(propertyService.normalize);
  },

  /**
   * Compare multiple saved rooms side-by-side (Phase 2)
   */
  compare: async (propertyIds, refLat = null, refLng = null) => {
    const payload = { propertyIds, refLat, refLng };
    const response = await apiClient.post('/properties/compare', payload);
    return response.data || [];
  },

  /**
   * Delete a saved property
   */
  delete: async (id) => {
    const response = await apiClient.delete(`/properties/${id}`);
    return response.data;
  },

  /**
   * Normalizer to ensure both new and legacy field names are guaranteed present
   */
  normalize: (item) => {
    if (!item) return item;
    const isVisited = item.visitStatus === 'visited' || item.visited === true;
    return {
      ...item,
      id: String(item.id),
      userId: String(item.userId || '1'),
      description: item.description || item.notes || '',
      notes: item.notes || item.description || '',
      price: item.price || item.rent || '',
      rent: item.rent || item.price || '',
      facilities: item.facilities || item.amenities || [],
      amenities: item.amenities || item.facilities || [],
      contactDetails: item.contactDetails || (item.contactPhone ? `${item.contactPerson || 'Contact'}: ${item.contactPhone}` : ''),
      contactPerson: item.contactPerson || (item.contactDetails ? item.contactDetails.split(':')[0] : ''),
      contactPhone: item.contactPhone || (item.contactDetails && item.contactDetails.includes(':') ? item.contactDetails.split(':')[1]?.trim() : item.contactDetails || ''),
      visitStatus: isVisited ? 'visited' : 'pending',
      visited: isVisited,
      isFavorite: Boolean(item.isFavorite || item.favorite),
      favorite: Boolean(item.isFavorite || item.favorite),
      createdDate: item.createdDate || item.createdAt || '',
      createdAt: item.createdAt || item.createdDate || '',
    };
  },
};

export default propertyService;
