export type FileStatus = 'Pending' | 'Processing' | 'Processed' | 'Failed';

export interface UploadedFile {
  id: string; // unique file identifier
  filename: string;
  uploadedAt: string; // ISO string
  claimsCount: number;
  status: FileStatus;
}

export interface UploadListFilters {
  fileId?: string;
}

export interface ClaimsByUploadFilters {
  claimId?: string;
  patientName?: string;
  status?: string; // Paid | Pending | Denied | etc
  page?: number;
  limit?: number;
}
