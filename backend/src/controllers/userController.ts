import { Request, Response } from 'express';
import { query } from '../config/db.js';
import { DbUser, ApiUser } from '../models/User.js';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT id, username, email, type FROM api_hboxuser WHERE type = \'BA\' OR type = \'BU\'');
    const dbUsers: DbUser[] = result.rows;

    const apiUsers: ApiUser[] = dbUsers.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.type === 'BA' ? 'Admin' : 'User',
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
