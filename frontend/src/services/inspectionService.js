import apiClient from './api';

export const inspectionService = {
  getTemplate: async () => {
    const response = await apiClient.get('/inspections/template');
    return response.data;
  },

  getByProperty: async (propertyId) => {
    const response = await apiClient.get(`/properties/${propertyId}/inspections`);
    return response.data || [];
  },

  getLatest: async (propertyId) => {
    try {
      const response = await apiClient.get(`/properties/${propertyId}/inspections/latest`);
      return response.data || null;
    } catch (e) {
      return null;
    }
  },

  getById: async (inspectionId) => {
    const response = await apiClient.get(`/inspections/${inspectionId}`);
    return response.data;
  },

  create: async (propertyId, data) => {
    const response = await apiClient.post(`/properties/${propertyId}/inspections`, data);
    return response.data;
  },

  update: async (inspectionId, data) => {
    const response = await apiClient.put(`/inspections/${inspectionId}`, data);
    return response.data;
  },

  delete: async (inspectionId) => {
    const response = await apiClient.delete(`/inspections/${inspectionId}`);
    return response.data;
  },
};

export default inspectionService;
