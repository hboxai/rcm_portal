import { Request, Response } from 'express';
import { query } from '../config/db.js';
import { ApiUser } from '../models/User.js';
import bcrypt from 'bcryptjs';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT id, username, email, role, status, last_login_at, created_at, updated_at 
      FROM rcm_portal_auth_users 
      WHERE status = 'active'
      ORDER BY created_at DESC
    `);
    
    const apiUsers: ApiUser[] = result.rows.map((r: any) => ({
      id: r.id,
      username: r.username,
      email: r.email,
      role: r.role === 'Admin' ? 'Admin' : 'User'
    }));

    res.status(200).json({
      success: true,
      data: apiUsers,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve users',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { username, email, password, role } = req.body;
    
    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: username, email, password'
      });
    }
    
    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM rcm_portal_auth_users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2)',
      [email, username]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'User with this email or username already exists'
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert new user
    const result = await query(`
      INSERT INTO rcm_portal_auth_users (username, email, password_hash, role, status)
      VALUES ($1, $2, $3, $4, 'active')
      RETURNING id, username, email, role, status, created_at
    `, [username, email, hashedPassword, role || 'User']);
    
    const newUser = result.rows[0];
    
    res.status(201).json({
      success: true,
      data: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      },
      message: 'User created successfully'
    });
    
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { username, email, role, status } = req.body;
    
    // Check if user exists
    const existingUser = await query('SELECT id FROM rcm_portal_auth_users WHERE id = $1', [id]);
    if (existingUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Update user
    const result = await query(`
      UPDATE rcm_portal_auth_users 
      SET username = COALESCE($2, username),
          email = COALESCE($3, email),
          role = COALESCE($4, role),
          status = COALESCE($5, status),
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, username, email, role, status, updated_at
    `, [id, username, email, role, status]);
    
    const updatedUser = result.rows[0];
    
    res.status(200).json({
      success: true,
      data: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role
      },
      message: 'User updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if user exists
    const existingUser = await query('SELECT id FROM rcm_portal_auth_users WHERE id = $1', [id]);
    if (existingUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Soft delete by setting status to 'deleted'
    await query(`
      UPDATE rcm_portal_auth_users 
      SET status = 'deleted', updated_at = NOW()
      WHERE id = $1
    `, [id]);
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
