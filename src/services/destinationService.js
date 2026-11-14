import apiClient from './api';

export const destinationService = {
  getAll: async (params = {}) => {
    const response = await apiClient.get('/properties', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await apiClient.get(`/properties/${id}`);
    return response.data;
  },

  create: async (data) => {
    const payload = {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const response = await apiClient.post('/properties', payload);
    return response.data;
  },

  update: async (id, data) => {
    const payload = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    const response = await apiClient.patch(`/properties/${id}`, payload);
    return response.data;
  },

  delete: async (id) => {
    const response = await apiClient.delete(`/properties/${id}`);
    return response.data;
  },
};
