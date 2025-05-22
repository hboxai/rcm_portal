import express from 'express';
import { getAllChangeHistory } from '../controllers/claimController';
import { authMiddleware } from '../middleware/auth'; // Added import

const router = express.Router();

// Route to get all change history, matching the frontend call to /api/history/all
router.get('/all', authMiddleware, getAllChangeHistory); // Added authMiddleware

export default router;
