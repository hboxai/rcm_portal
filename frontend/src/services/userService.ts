import axios from 'axios';
import { User } from '../types/user';
import { API_BASE_URL } from '../config/api';

// Use API_URL as alias for backward compatibility
const API_URL = API_BASE_URL;

interface GetUsersResponse {
  success: boolean;
  data: User[];
  message?: string;
}

interface UserResponse {
  success: boolean;
  data: User;
  message?: string;
}

// Helper to get the auth token
const getAuthToken = (token: string) => {
  return `Bearer ${token}`;
};

export const getUsers = async (token: string): Promise<User[]> => {
  try {
    const response = await axios.get<GetUsersResponse>(`${API_URL}/users`, {
      headers: {
        Authorization: getAuthToken(token),
      },
    });
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch users');
  } catch (error) {
    console.error('Error fetching users:', error);
    // Handle error appropriately in the UI
    throw error;
  }
};

export const createUser = async (userData: {
  username: string;
  email: string;
  password: string;
  role: string;
}, token: string): Promise<User> => {
  try {
    const response = await axios.post<UserResponse>(`${API_URL}/users`, userData, {
      headers: {
        Authorization: getAuthToken(token),
      },
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to create user');
  } catch (error: any) {
    console.error('Error creating user:', error);
    
    // If the error is due to a duplicate username/email
    if (error.response?.status === 409 || error.response?.data?.message?.includes('already exists')) {
      throw new Error('A user with this username or email already exists');
    }
    
    throw error;
  }
};

export const updateUser = async (
  userId: string | number,
  userData: Partial<{
    username: string;
    email: string;
    password: string;
    role: string;
  }>,
  token: string
): Promise<User> => {
  try {
    const response = await axios.put<UserResponse>(
      `${API_URL}/users/${userId}`,
      userData,
      {
        headers: {
          Authorization: getAuthToken(token),
        },
      }
    );
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to update user');
  } catch (error: any) {
    console.error('Error updating user:', error);
    
    // If the error is due to a duplicate username/email
    if (error.response?.status === 409 || error.response?.data?.message?.includes('already exists')) {
      throw new Error('Another user with this username or email already exists');
    }
    
    throw error;
  }
};

export const deleteUser = async (userId: string | number, token: string): Promise<boolean> => {
  try {
    const response = await axios.delete<{ success: boolean; message?: string }>(
      `${API_URL}/users/${userId}`,
      {
        headers: {
          Authorization: getAuthToken(token),
        },
      }
    );
    
    return response.data.success;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};
