import { Request, Response } from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

/**
 * User authentication controller
 * Handles login, registration, and user verification
 */

// Detached portal auth now uses rcm_portal_auth_users exclusively.

/**
 * Login user and generate JWT token
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const normEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normPassword = typeof password === 'string' ? password.trim() : '';
    if (!normEmail || !normPassword) {
      return res.status(400).json({ status: 'error', message: 'Email and password are required' });
    }

    const authRes = await pool.query(
      `SELECT id, email, username, password_hash, role, status FROM rcm_portal_auth_users WHERE LOWER(email)=$1 AND status='active'`,
      [normEmail]
    );
    if (!authRes.rowCount) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }
    const authRow = authRes.rows[0];
    const passwordOk = await bcrypt.compare(normPassword, authRow.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    const role = authRow.role === 'Admin' ? 'Admin' : 'User';

    const jwtSecret = process.env.JWT_SECRET || '';
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set');
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }

    const token = jwt.sign(
      { id: authRow.id, email: authRow.email, role, username: authRow.username },
      jwtSecret as Secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' } as jwt.SignOptions
    );

    // Update last_login_at (ignore errors)
    pool.query('UPDATE rcm_portal_auth_users SET last_login_at = NOW() WHERE id=$1', [authRow.id]).catch(()=>{});

    return res.status(200).json({
      status: 'success',
      data: {
        user: { id: authRow.id, name: authRow.username, email: authRow.email, role },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error', error: error instanceof Error ? error.message : String(error) });
  }
};

/**
 * Verify user JWT token
 */
export const verifyToken = async (req: Request, res: Response) => {
  try {
    // Support both POST with body.token and GET with Authorization header
    let token: string | undefined = req.body?.token;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }
    if (!token) {
      return res.status(400).json({ status: 'error', message: 'Token is required' });
    }

    const jwtSecret = process.env.JWT_SECRET || '';
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set');
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret as Secret) as any;
      const user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name || decoded.username || (decoded.email ? decoded.email.split('@')[0] : 'user'),
        username: decoded.username || decoded.name || (decoded.email ? decoded.email.split('@')[0] : 'user')
      };
      
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
          user,
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