export interface User {
  id: number;
  username: string;
  email: string;
  role: 'Admin' | 'User';
}
