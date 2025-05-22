import express from 'express';
import { getAllChangeHistory } from '../controllers/claimController.js';
import { authMiddleware } from '../middleware/auth.js'; // Added import

const router = express.Router();

// Route to get all change history, matching the frontend call to /api/history/all
router.get('/all', authMiddleware, getAllChangeHistory); // Added authMiddleware

export default router;
