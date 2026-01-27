import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config/api';

// CSRF token management
let csrfToken: string | null = null;

// Token refresh state
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

// Get CSRF token from cookie
function getCsrfFromCookie(): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split('; csrf_token=');
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

// Get current CSRF token
export function getCsrfToken(): string | null {
  return csrfToken || getCsrfFromCookie() || localStorage.getItem('csrfToken');
}

// Set CSRF token
export function setCsrfToken(token: string): void {
  csrfToken = token;
  localStorage.setItem('csrfToken', token);
}

// Clear CSRF token (call on logout)
export function clearCsrfToken(): void {
  csrfToken = null;
  localStorage.removeItem('csrfToken');
}

// Subscribe to token refresh
function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

// Notify all subscribers with new token
function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
}

// Check if token is expiring soon
function isTokenExpiringSoon(bufferSeconds = 60): boolean {
  const token = localStorage.getItem('token');
  if (!token) return true;

  try {
    const payloadBase64 = token.split('.')[1];
    const payload = JSON.parse(atob(payloadBase64));
    const exp = payload.exp * 1000;
    return Date.now() >= (exp - bufferSeconds * 1000);
  } catch {
    return true;
  }
}

// Refresh access token
async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/auth/refresh`,
      {},
      { withCredentials: true }
    );

    if (response.data.status === 'success') {
      const { token } = response.data.data;
      localStorage.setItem('token', token);
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

// Request interceptor to add tokens
axios.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const method = config.method?.toUpperCase();
    
    // Add CSRF token to POST, PUT, DELETE, PATCH requests
    if (method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const token = getCsrfToken();
      if (token) {
        config.headers['X-CSRF-Token'] = token;
      }
    }
    
    // Add Authorization header if token exists
    const authToken = localStorage.getItem('token');
    if (authToken && !config.url?.includes('/auth/login') && !config.url?.includes('/auth/refresh')) {
      config.headers['Authorization'] = `Bearer ${authToken}`;
      
      // Proactively refresh if token is expiring soon (not for refresh endpoint itself)
      if (isTokenExpiringSoon(120) && !isRefreshing) {
        isRefreshing = true;
        const newToken = await refreshAccessToken();
        isRefreshing = false;
        
        if (newToken) {
          config.headers['Authorization'] = `Bearer ${newToken}`;
          onTokenRefreshed(newToken);
        }
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors and capture tokens
axios.interceptors.response.use(
  (response) => {
    // Capture CSRF token from response header if present
    const newToken = response.headers['x-csrf-token'];
    if (newToken) {
      setCsrfToken(newToken);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // Handle 401 Unauthorized - try to refresh token
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Don't retry for login/refresh endpoints
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
        localStorage.removeItem('token');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        
        try {
          const newToken = await refreshAccessToken();
          isRefreshing = false;
          
          if (newToken) {
            onTokenRefreshed(newToken);
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return axios(originalRequest);
          } else {
            // Refresh failed - redirect to login
            localStorage.removeItem('token');
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
            return Promise.reject(error);
          }
        } catch {
          isRefreshing = false;
          localStorage.removeItem('token');
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
          return Promise.reject(error);
        }
      } else {
        // Wait for ongoing refresh to complete
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            resolve(axios(originalRequest));
          });
        });
      }
    }
    
    // Handle CSRF errors - fetch new token and suggest retry
    if (error.response?.status === 403) {
      const code = (error.response.data as { code?: string })?.code;
      if (code === 'CSRF_TOKEN_MISSING' || code === 'CSRF_TOKEN_INVALID') {
        clearCsrfToken();
        console.warn('CSRF token error - token cleared. Please retry the action.');
      }
    }
    
    return Promise.reject(error);
  }
);

// Configure axios defaults
axios.defaults.withCredentials = true;

export default axios;
