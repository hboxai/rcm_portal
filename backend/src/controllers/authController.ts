import { Request, Response } from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

/**
 * User authentication controller
 * Handles login, registration, and user verification
 */

interface User {
  id: number;
  email: string;
  password: string;
  name: string;
  role: string;
}

interface UserFromDb {
  id: number;
  email: string;
  password?: string; // Password hash from DB
  username: string;
  type: string; // e.g., 'BA', 'BU'
}

/**
 * Login user and generate JWT token
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Email and password are required' 
      });
    }

    // Fetch user from the api_hboxuser table
    const userQuery = await pool.query(
      'SELECT id, email, password, username, type FROM api_hboxuser WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (userQuery.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    const userFromDb: UserFromDb = userQuery.rows[0];

    if (!userFromDb.password) {
      // User exists but has no password set in DB
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Compare provided password with the stored hash
    const passwordIsValid = await bcrypt.compare(password, userFromDb.password);

    if (!passwordIsValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Determine role from type
    let role = 'User'; // Default role
    if (userFromDb.type === 'BA') {
      role = 'Admin';
    }
    // Add other type-to-role mappings if necessary

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || '';
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set');
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    }

    const token = jwt.sign(
      { 
        id: userFromDb.id, 
        email: userFromDb.email,
        role: role // Use determined role
      },
      jwtSecret as Secret,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      } as jwt.SignOptions
    );

    // Send response with token
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: userFromDb.id,
          name: userFromDb.username, // Use username from DB
          email: userFromDb.email,
          role: role // Use determined role
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Verify user JWT token
 */
export const verifyToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'Token is required'
      });
    }

    const jwtSecret = process.env.JWT_SECRET || '';
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set');
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret as Secret);
      
      // In a real implementation, you would verify the user still exists in the database
      // const userQuery = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);
      // if (userQuery.rows.length === 0) {
      //   return res.status(401).json({
      //     status: 'error',
      //     message: 'User no longer exists'
      //   });
      // }

      res.status(200).json({
        status: 'success',
        data: { 
          user: decoded,
          valid: true
        }
      });
    } catch (jwtError) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or expired token',
        valid: false
      });
    }
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};