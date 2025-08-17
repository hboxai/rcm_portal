import express from 'express';
import * as authController from '../controllers/authController.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Strict rate limit for login endpoint
const loginLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

/**
 * Authentication routes
 */
router.post('/login', loginLimiter, authController.login);
router.post('/verify', authController.verifyToken);

export default router;