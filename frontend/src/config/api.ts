/**
 * API Configuration
 * 
 * Centralized configuration for API endpoints.
 * Uses environment variables with fallback defaults.
 */

// Base API URL - uses Vite's environment variable system
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// ERA parsing API has its own base path
export const ERA_API_BASE_URL = `${API_BASE_URL}/era`;

// Individual endpoint paths (for documentation and type safety)
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    VERIFY: '/auth/verify',
  },
  // Claims
  CLAIMS: '/claims',
  // Uploads
  UPLOADS: '/uploads',
  // Reimburse
  REIMBURSE: '/reimburse',
  // Submit uploads
  SUBMIT_UPLOADS: '/submit-uploads',
  // Users
  USERS: '/users',
  // History
  HISTORY: '/history',
  // Audit
  AUDIT: '/audit',
} as const;

export default {
  API_BASE_URL,
  ERA_API_BASE_URL,
  API_ENDPOINTS,
};
