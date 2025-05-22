import { Router } from 'express';
import { getUsers } from '../controllers/userController';
import { authMiddleware } from '../middleware/auth'; // Corrected import

const router = Router();

/**
 * @route GET /api/users
 * @description Get all users with type 'BA' or 'BU', mapped to 'Admin' and 'User' roles
 * @access Private (requires authentication)
 */
router.get('/', authMiddleware, getUsers); // Corrected usage

export default router;
