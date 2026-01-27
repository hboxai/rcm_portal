import { LoginCredentials, User } from '../types/auth';
 
import * as _jose from 'jose';
import axios from '../utils/axiosSetup';
import { API_BASE_URL } from '../config/api';

/**
 * Authentication service for handling user login and token management
 */
export const authService = {
  /**
   * Authenticate user and get JWT token
   */
  async login(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
    try {
      // Always connect to real backend - no mock login
      const response = await axios.post(`${API_BASE_URL}/auth/login`, credentials);
      
      const data = response.data;
      
      // Store token in localStorage
      if (data.data.token) {
        localStorage.setItem('token', data.data.token);
      }
      
      return {
        user: data.data.user,
        token: data.data.token,
      };
      
    } catch (error: any) {
      console.error('Login error (full details):', error);
      
      // Provide user-friendly error messages
      if (error.response?.status === 429) {
        // Rate limit error
        const retryAfter = error.response?.data?.retryAfter || '5 minutes';
        throw new Error(`Too many login attempts. Please try again in ${retryAfter}.`);
      } else if (error.response?.status === 401) {
        throw new Error('Invalid email or password');
      } else if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      } else if (error.code === 'ERR_NETWORK') {
        throw new Error('Unable to connect to server. Please check your connection.');
      } else {
        throw new Error('Login failed. Please try again.');
      }
    }
  },

  /**
   * Remove auth token and user info
   */
  logout(): void {
    localStorage.removeItem('token');
  },

  /**
   * Get current auth token
   */
  getToken(): string | null {
    return localStorage.getItem('token');
  },
  
  /**
   * Get current user information from token
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const token = this.getToken();
      if (!token) return null;
      
      const { valid, user } = await this.verifyToken(token);
      if (valid && user) {
        return user;
      }
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },
  
  /**
   * Get user information without async verification - for non-critical operations
   */
  getUserSync(): User | null {
    try {
      const token = this.getToken();
      if (!token) return null;
      
      // For JWT tokens, extract the payload
      if (token.startsWith('ey')) {
        const payloadBase64 = token.split('.')[1];
        const payload = JSON.parse(atob(payloadBase64));
        
        return {
          id: payload.id || '0',
          email: payload.email || 'unknown',
          name: payload.name || payload.email?.split('@')[0] || 'Unknown User',
          username: payload.username || payload.name || payload.email?.split('@')[0] || 'user',
          role: payload.role || 'User'
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error in getUserSync:', error);
      return null;
    }
  },

  /**
   * Verify if token is valid
   */
  async verifyToken(token: string): Promise<{ valid: boolean; user?: User }> {
    try {
      // Always verify token with backend
      const response = await axios.get(`${API_BASE_URL}/auth/verify`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.status === 'success' && response.data.data.user) {
        return {
          valid: true,
          user: response.data.data.user
        };
      }
      
      return { valid: false };
    } catch (error) {
      console.error('Token verification error:', error);
      return { valid: false };
    }
  },

  /**
   * Refresh access token using refresh token cookie
   */
  async refreshToken(): Promise<{ token: string; user: User } | null> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true }
      );

      if (response.data.status === 'success') {
        const { token, user } = response.data.data;
        localStorage.setItem('token', token);
        return { token, user };
      }
      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  },

  /**
   * Logout from server (revokes refresh token)
   */
  async logoutFromServer(): Promise<void> {
    try {
      await axios.post(
        `${API_BASE_URL}/auth/logout`,
        {},
        { withCredentials: true }
      );
    } catch (error) {
      console.error('Server logout failed:', error);
    }
  },

  /**
   * Logout from all devices
   */
  async logoutAllDevices(): Promise<void> {
    try {
      const token = this.getToken();
      await axios.post(
        `${API_BASE_URL}/auth/logout-all`,
        {},
        { 
          withCredentials: true,
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );
    } catch (error) {
      console.error('Logout all devices failed:', error);
    }
  },

  /**
   * Check if token is expired or about to expire
   */
  isTokenExpiringSoon(bufferSeconds = 60): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      const payloadBase64 = token.split('.')[1];
      const payload = JSON.parse(atob(payloadBase64));
      const exp = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      
      return now >= (exp - bufferSeconds * 1000);
    } catch {
      return true;
    }
  },
};