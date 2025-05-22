export interface Patient {
  id: string;
  name: string;
  dob: string;
  gender: string;
  contact: string;
  address: string;
  insurance: Insurance;
}

export interface Insurance {
  provider: string;
  policyNumber: string;
  groupNumber: string;
  effectiveDate: string;
  expirationDate: string;
}

export interface VisitClaim {
  id?: string;
  claimId: string;
  patientName: string;
  memberId: string;
  payer: string;
  billedAmount: number;
  paidAmount?: number;
  status: string; // Changed from specific union to string
  dos?: string; // Date of Service
  dateOfBirth?: string; // Date of Birth
  visitType?: string;
  cptCodes?: string[];
  icdCodes?: string[];
  notes?: string[];
  visitDetails?: VisitDetail[];
  changeLog?: ChangeLogEntry[]; // Added this line
  createdAt?: string;
  updatedAt?: string;
  billing_id?: number | null; // Changed from cpt_id and type to number
}

export interface VisitDetail {
  id?: string;
  date: string;
  type: 'Appointment' | 'Lab Test' | 'Imaging' | 'Procedure' | 'Other';
  summary: string;
  clinician?: string;
  facility?: string;
  documents?: Array<{ name: string; url: string; type: string }>;
}

// Added ChangeLogEntry interface
export interface ChangeLogEntry {
  timestamp: string;
  userId: string; // Or userName, depending on what you store
  action: string; // e.g., "Created", "Updated Status to Paid", "Added Note"
  details?: Record<string, any>; // For storing what changed, if needed
}


export interface KPIData {
  totalClaims: number;
  pendingClaims: number;
  paidClaims: number;
  deniedClaims: number;
  averageCollectionRate?: number; // Optional as it might not always be available
  averageClaimProcessingTime?: number; // In days, optional
}

export interface SearchFilters {
  patientName?: string;
  claimId?: string;
  status?: 'Pending' | 'Paid' | 'Denied' | 'Appealed' | '';
  dateOfServiceStart?: string;
  dateOfServiceEnd?: string;
  payer?: string; // Existing payer field
  page?: number;
  limit?: number;
  // Added fields from SearchForm state
  patientId?: string;
  billingId?: string; 
  dos?: string; // This might conflict or be redundant with dateOfServiceStart/End
  firstName?: string;
  lastName?: string;
  payerName?: string; // This might be different from payer
  dateOfBirth?: string;
  cptCode?: string;
}

export interface PaginatedClaimsResponse {
  claims: VisitClaim[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ClaimNote {
  id?: string;
  claimId: string;
  userId: string; // or username
  note: string;
  timestamp?: string;
}

// Define ChangeLog interface to match backend model upl_change_logs
export interface ChangeLog {
  id: number;
  user_id?: number; // Optional, as HistoryPage uses username primarily
  username: string; // Corresponds to username in upl_change_logs
  cpt_id: number | null; // This is the billing ID from the backend
  timestamp: string; // Corresponds to timestamp in upl_change_logs
  field_name: string; // Corresponds to field_name in upl_change_logs
  old_value: string | null; // Corresponds to old_value in upl_change_logs
  new_value: string | null; // Corresponds to new_value in upl_change_logs
  action_type?: 'created' | 'updated' | 'deleted'; // Optional, if needed from backend
}

export interface HistoryFilters {
  user_id?: number;
  user_name?: string; // maps to 'username' query param for backend
  username?: string; // kept for internal state if needed, but user_name is used for API
  cpt_id?: string; // This is the billing ID from the backend
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedHistoryResponse {
  success: boolean;
  data: ChangeLog[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  message?: string;
}
