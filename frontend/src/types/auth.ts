export interface User {
  id: string;
  name: string;
  username: string; // Added username
  email: string;
  role: string;
  avatar?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
