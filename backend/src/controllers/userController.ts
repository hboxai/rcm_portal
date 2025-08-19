import { Request, Response } from 'express';
import { query } from '../config/db.js';
import { DbUser, ApiUser } from '../models/User.js';
import { PORTAL_USER_SELECT } from '../models/PortalUser.js';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const result = await query(PORTAL_USER_SELECT + ` WHERE (u.type='BA' OR u.type='BU')`);
  const apiUsers: ApiUser[] = result.rows.map((r: any) => ({
      id: r.user_id,
      username: r.username,
      email: r.email,
      role: r.portal_role === 'Admin' ? 'Admin' : 'User'
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
