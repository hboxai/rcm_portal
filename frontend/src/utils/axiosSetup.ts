import axios from 'axios';

// CSRF token management
let csrfToken: string | null = null;

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

// Request interceptor to add CSRF token to state-changing requests
axios.interceptors.request.use(
  (config) => {
    const method = config.method?.toUpperCase();
    
    // Add CSRF token to POST, PUT, DELETE, PATCH requests
    if (method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const token = getCsrfToken();
      if (token) {
        config.headers['X-CSRF-Token'] = token;
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to capture CSRF token from responses
axios.interceptors.response.use(
  (response) => {
    // Capture CSRF token from response header if present
    const newToken = response.headers['x-csrf-token'];
    if (newToken) {
      setCsrfToken(newToken);
    }
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized errors globally
    if (error.response && error.response.status === 401) {
      // Clear token to force re-login
      localStorage.removeItem('token');
      
      // Redirect to login page if not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    // Handle CSRF errors - fetch new token and suggest retry
    if (error.response && error.response.status === 403) {
      const code = error.response.data?.code;
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
