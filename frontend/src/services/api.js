import axios from 'axios';
import { storage } from '../utils/storage';

// Centralized API Base URL configuration:
// Prioritizes VITE_API_BASE_URL (configured in Vercel environment variables),
// with backwards compatibility for VITE_API_URL and automatic local dev fallback.
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:8080/api' : '/api');

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor: Attach JWT/Auth token if available
apiClient.interceptors.request.use(
  (config) => {
    const token = storage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Uniform error handling and unwrapping
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'An unexpected error occurred. Please try again.';
    if (error.response) {
      message =
        error.response.data?.message ||
        error.response.data?.error ||
        `Request failed with status ${error.response.status}`;
    } else if (error.request) {
      message = 'Cannot connect to RoomTrail backend server. Please verify the backend service is running and accessible.';
    } else {
      message = error.message;
    }

    const enhancedError = new Error(message);
    enhancedError.originalError = error;
    enhancedError.status = error.response ? error.response.status : null;
    return Promise.reject(enhancedError);
  }
);

export default apiClient;
