import { LoginCredentials, User } from '../types/auth';
import * as jose from 'jose';
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
      console.log('Attempting to login with credentials:', {
        email: credentials.email,
        passwordLength: credentials.password?.length || 0
      });
      
      // Always connect to real backend - no mock login
      console.log('Sending login request to:', `${API_BASE_URL}/auth/login`);
      
      const response = await axios.post(`${API_BASE_URL}/auth/login`, credentials);
      console.log('Login response status:', response.status);
      
      const data = response.data;
      console.log('Login successful, received token and user data');
      
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
};