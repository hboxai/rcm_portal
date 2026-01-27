import express from 'express';
import * as authController from '../controllers/authController.js';
import { getCsrfToken } from '../middleware/csrf.js';
import { authMiddleware } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Strict rate limit for login endpoint
const loginLimiter = rateLimit({ 
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 attempts
  standardHeaders: true, 
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many login attempts. Please try again in 5 minutes.',
    retryAfter: '5 minutes'
  }
});

// Rate limit for refresh token endpoint
const refreshLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 refreshes per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many refresh attempts. Please try again later.',
  }
});

/**
 * Authentication routes
 */
router.post('/login', loginLimiter, authController.login);
router.post('/verify', authController.verifyToken);
router.get('/verify', authController.verifyToken);

// Refresh token endpoint - get new access token using refresh token
router.post('/refresh', refreshLimiter, authController.refreshAccessToken);

// Logout endpoints
router.post('/logout', authController.logout);
router.post('/logout-all', authMiddleware, authController.logoutAll);

// CSRF token endpoint - get a fresh CSRF token
router.get('/csrf-token', getCsrfToken);

export default router;