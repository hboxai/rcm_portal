export interface PortalUser {
  user_id: number;
  portal_role: 'Admin' | 'User';
  status: 'active' | 'disabled';
  last_login_portal?: string; // ISO timestamp
  created_at?: string;
  updated_at?: string;
}

export const PORTAL_USER_SELECT = `
SELECT u.id as user_id,
       COALESCE(rpu.portal_role, CASE WHEN u.type='BA' THEN 'Admin' ELSE 'User' END) AS portal_role,
       COALESCE(rpu.status, 'active') AS status,
       rpu.last_login_portal,
       rpu.created_at,
       rpu.updated_at,
       u.username,
       u.email,
       u.type
FROM api_hboxuser u
LEFT JOIN rcm_portal_users rpu ON rpu.user_id = u.id
`;
