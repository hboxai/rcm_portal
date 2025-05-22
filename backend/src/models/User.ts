export interface DbUser {
  id: number;
  username: string;
  email: string;
  type: 'BA' | 'BU' | string; // Allow other types from DB but we only care about BA/BU
  // Add other relevant fields from api_hboxuser table as needed
}

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  role: 'Admin' | 'User';
  // Add other fields as needed, matching what you want to expose
}
