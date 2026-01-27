import express from 'express';
import * as authController from '../controllers/authController.js';
import { getCsrfToken } from '../middleware/csrf.js';
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

/**
 * Authentication routes
 */
router.post('/login', loginLimiter, authController.login);
router.post('/verify', authController.verifyToken);
router.get('/verify', authController.verifyToken);

// CSRF token endpoint - get a fresh CSRF token
router.get('/csrf-token', getCsrfToken);

export default router;