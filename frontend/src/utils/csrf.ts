import axios from './axiosSetup';
import { API_BASE_URL } from '../config/api';

const CSRF_TOKEN_KEY = 'csrfToken';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/**
 * CSRF Token management for frontend
 * Fetches and stores CSRF token, attaches to all state-changing requests
 */

let csrfToken: string | null = null;

/**
 * Get the current CSRF token from memory or cookie
 */
export function getCsrfToken(): string | null {
  if (csrfToken) {
    return csrfToken;
  }
  
  // Try to get from cookie
  const cookieToken = getCookie('csrf_token');
  if (cookieToken) {
    csrfToken = cookieToken;
    return csrfToken;
  }
  
  // Try localStorage as fallback
  const storedToken = localStorage.getItem(CSRF_TOKEN_KEY);
  if (storedToken) {
    csrfToken = storedToken;
    return csrfToken;
  }
  
  return null;
}

/**
 * Set the CSRF token
 */
export function setCsrfToken(token: string): void {
  csrfToken = token;
  localStorage.setItem(CSRF_TOKEN_KEY, token);
}

/**
 * Clear the CSRF token (on logout)
 */
export function clearCsrfToken(): void {
  csrfToken = null;
  localStorage.removeItem(CSRF_TOKEN_KEY);
}

/**
 * Fetch a fresh CSRF token from the server
 */
export async function fetchCsrfToken(): Promise<string | null> {
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/csrf-token`, {
      withCredentials: true,
    });
    
    const token = response.data?.data?.csrfToken;
    if (token) {
      setCsrfToken(token);
      return token;
    }
    
    // Also check response header
    const headerToken = response.headers['x-csrf-token'];
    if (headerToken) {
      setCsrfToken(headerToken);
      return headerToken;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to fetch CSRF token:', error);
    return null;
  }
}

/**
 * Get CSRF token, fetching if necessary
 */
export async function ensureCsrfToken(): Promise<string | null> {
  const existing = getCsrfToken();
  if (existing) {
    return existing;
  }
  return fetchCsrfToken();
}

/**
 * Get cookie value by name
 */
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

/**
 * Get headers object with CSRF token for fetch/axios requests
 */
export function getCsrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  if (token) {
    return { [CSRF_HEADER_NAME]: token };
  }
  return {};
}

export default {
  getCsrfToken,
  setCsrfToken,
  clearCsrfToken,
  fetchCsrfToken,
  ensureCsrfToken,
  getCsrfHeaders,
};
