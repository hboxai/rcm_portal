import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger.js';

// In-memory token store (in production, consider Redis for multi-instance deployments)
const tokenStore = new Map<string, { token: string; expires: number }>();

// Configuration
const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_COOKIE_NAME = 'csrf_token';

// Methods that require CSRF protection (state-changing requests)
const PROTECTED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

// Routes that are exempt from CSRF protection (auth routes need to work without prior token)
const EXEMPT_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/verify',
  '/api/auth/refresh',
  '/api/auth/csrf-token',
  '/api/health',
];

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Store a CSRF token associated with a session/user identifier
 */
export function storeToken(identifier: string, token: string): void {
  tokenStore.set(identifier, {
    token,
    expires: Date.now() + CSRF_TOKEN_EXPIRY_MS,
  });
}

/**
 * Validate a CSRF token
 */
export function validateToken(identifier: string, token: string): boolean {
  const stored = tokenStore.get(identifier);
  
  if (!stored) {
    return false;
  }
  
  // Check expiration
  if (Date.now() > stored.expires) {
    tokenStore.delete(identifier);
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(stored.token),
      Buffer.from(token)
    );
  } catch {
    return false;
  }
}

/**
 * Clean up expired tokens periodically
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [key, value] of tokenStore.entries()) {
    if (now > value.expires) {
      tokenStore.delete(key);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

/**
 * Get client identifier for CSRF token association
 * Uses a combination of IP and user agent for anonymous users,
 * or user ID for authenticated users
 */
function getClientIdentifier(req: Request): string {
  // If authenticated, use user ID
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }
  
  // For anonymous users, use IP + user agent hash
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const hash = crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex').substring(0, 16);
  return `anon:${hash}`;
}

/**
 * Check if route is exempt from CSRF protection
 */
function isExemptRoute(path: string): boolean {
  return EXEMPT_ROUTES.some(route => {
    if (route.endsWith('*')) {
      return path.startsWith(route.slice(0, -1));
    }
    return path === route || path.startsWith(route + '/');
  });
}

/**
 * CSRF Protection Middleware
 * 
 * For GET requests: Sets CSRF token cookie and makes token available
 * For state-changing requests: Validates CSRF token from header
 */
export const csrfMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const identifier = getClientIdentifier(req);
  
  // For GET requests, generate and set token
  if (req.method === 'GET') {
    let stored = tokenStore.get(identifier);
    
    // Generate new token if none exists or expired
    if (!stored || Date.now() > stored.expires) {
      const newToken = generateCsrfToken();
      storeToken(identifier, newToken);
      stored = tokenStore.get(identifier);
    }
    
    if (stored) {
      // Set token in cookie (accessible to JavaScript for SPA)
      res.cookie(CSRF_COOKIE_NAME, stored.token, {
        httpOnly: false, // Must be readable by JavaScript
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: CSRF_TOKEN_EXPIRY_MS,
      });
      
      // Also expose in response header for easy access
      res.setHeader('X-CSRF-Token', stored.token);
    }
    
    return next();
  }
  
  // For state-changing methods, validate token
  if (PROTECTED_METHODS.includes(req.method)) {
    // Check if route is exempt
    if (isExemptRoute(req.path)) {
      return next();
    }
    
    // Get token from header (preferred) or body
    const headerToken = req.headers[CSRF_HEADER_NAME] as string;
    const bodyToken = req.body?._csrf;
    const submittedToken = headerToken || bodyToken;
    
    if (!submittedToken) {
      logger.warn({ 
        path: req.path, 
        method: req.method,
        identifier 
      }, 'CSRF token missing');
      
      return res.status(403).json({
        status: 'error',
        message: 'CSRF token missing. Please refresh the page and try again.',
        code: 'CSRF_TOKEN_MISSING',
      });
    }
    
    if (!validateToken(identifier, submittedToken)) {
      logger.warn({ 
        path: req.path, 
        method: req.method,
        identifier 
      }, 'CSRF token invalid');
      
      return res.status(403).json({
        status: 'error',
        message: 'CSRF token invalid or expired. Please refresh the page and try again.',
        code: 'CSRF_TOKEN_INVALID',
      });
    }
    
    // Token is valid, continue
    logger.debug({ path: req.path, method: req.method }, 'CSRF token validated');
  }
  
  next();
};

/**
 * Route handler to get a new CSRF token
 * Useful for SPAs that need to fetch token after initial page load
 */
export const getCsrfToken = (req: Request, res: Response) => {
  const identifier = getClientIdentifier(req);
  const token = generateCsrfToken();
  storeToken(identifier, token);
  
  // Set cookie
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_TOKEN_EXPIRY_MS,
  });
  
  res.json({
    status: 'success',
    data: { csrfToken: token },
  });
};

export default csrfMiddleware;
