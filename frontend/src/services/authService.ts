import { LoginCredentials, User } from '../types/auth';
import * as jose from 'jose';

// Use a direct string to avoid any environment variable issues
const API_BASE_URL = '/api';

// Use environment variable for mock JWT secret (for frontend dev only)
const MOCK_JWT_SECRET = import.meta.env.VITE_MOCK_JWT_SECRET || '';

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
      
      // For demo/development purposes only - allows direct login with mock data
      // when API server is not available
      if (credentials.email === 'HBilling_RCM@hbox.ai' && credentials.password === 'Admin@2025') {
        console.log('Using mock login for admin user');
        const mockUser = {
          id: '1',
          email: 'HBilling_RCM@hbox.ai',
          name: 'Admin User',
          username: 'admin',
          role: 'Admin'
        };
        
        // Create a proper JWT token using jose library
        const secret = new TextEncoder().encode(MOCK_JWT_SECRET);
        const token = await new jose.SignJWT({ 
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('24h')
          .sign(secret);
        
        // Store token
        localStorage.setItem('token', token);
        
        return {
          user: mockUser,
          token: token
        };
      }
      
      // Add mock login for regular user
      if (credentials.email === 'syed.a@hbox.ai' && credentials.password === 'User@2025') {
        console.log('Using mock login for regular user');
        const mockUser = {
          id: '2',
          email: 'syed.a@hbox.ai',
          name: 'Regular User',
          username: 'user',
          role: 'User'
        };
        
        // Create a proper JWT token using jose library
        const secret = new TextEncoder().encode(MOCK_JWT_SECRET);
        const token = await new jose.SignJWT({ 
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role
        })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('24h')
          .sign(secret);
        
        // Store token
        localStorage.setItem('token', token);
        
        return {
          user: mockUser,
          token: token
        };
      }

      // If not using mock login, connect to real backend
      console.log('Sending login request to:', `${API_BASE_URL}/auth/login`);
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      console.log('Login response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Login response error:', errorData);
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await response.json();
      console.log('Login successful, received token and user data');
      
      // Store token in localStorage
      if (data.data.token) {
        localStorage.setItem('token', data.data.token);
      }
      
      return {
        user: data.data.user,
        token: data.data.token,
      };
    } catch (error) {
      console.error('Login error (full details):', error);
      throw error;
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
      // For mock tokens, verify them locally
      if (token.startsWith('ey')) {
        try {
          const secret = new TextEncoder().encode(MOCK_JWT_SECRET);
          const { payload } = await jose.jwtVerify(token, secret);
          
          if (payload) {
            return { 
              valid: true, 
              user: {
                id: payload.id as string,
                email: payload.email as string,
                name: payload.name as string || (payload.email as string).split('@')[0],
                username: payload.username as string || payload.name as string || (payload.email as string).split('@')[0],
                role: payload.role as string
              } 
            };
          }
        } catch (jwtError) {
          console.error('JWT verification error:', jwtError);
          return { valid: false };
        }
      }
      
      // For real backend tokens, verify with backend
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        return { valid: false };
      }

      const data = await response.json();
      return {
        valid: data.data.valid,
        user: data.data.user,
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return { valid: false };
    }
  },
};