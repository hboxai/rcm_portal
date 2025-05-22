import express from 'express';
import * as authController from '../controllers/authController.js';

const router = express.Router();

/**
 * Authentication routes
 */
router.post('/login', authController.login);
router.post('/verify', authController.verifyToken);

export default router;