import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

/**
 * @route GET /api/users
 * @description Get all active users
 * @access Private (requires authentication)
 */
router.get('/', authMiddleware, getUsers);

/**
 * @route POST /api/users
 * @description Create a new user
 * @access Private (requires authentication)
 */
router.post('/', authMiddleware, createUser);

/**
 * @route PUT /api/users/:id
 * @description Update a user
 * @access Private (requires authentication)
 */
router.put('/:id', authMiddleware, updateUser);

/**
 * @route DELETE /api/users/:id
 * @description Delete a user (soft delete)
 * @access Private (requires authentication)
 */
router.delete('/:id', authMiddleware, deleteUser);

export default router;
