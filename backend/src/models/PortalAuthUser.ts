export interface PortalAuthUser {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  role: 'Admin' | 'User';
  status: 'active' | 'disabled';
  last_login_at?: string;
  created_at?: string;
  updated_at?: string;
}
