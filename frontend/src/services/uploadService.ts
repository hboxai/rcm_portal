import axios from '../utils/axiosSetup';
import { UploadedFile, UploadListFilters, ClaimsByUploadFilters } from '../types/file';
import { PaginatedClaimsResponse, SearchFilters } from '../types/claim';

const API_BASE_URL = '/api';

const getAuthToken = () => {
  const token = localStorage.getItem('token');
  return token ? `Bearer ${token}` : '';
};

export async function uploadMetabaseExport(file: File, onProgress?: (pct: number) => void): Promise<{ success: boolean; file?: UploadedFile; message?: string }>{
  try {
    const form = new FormData();
    form.append('file', file);
    const res = await axios.post(`${API_BASE_URL}/uploads`, form, {
      headers: { Authorization: getAuthToken(), 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) {
          const raw = Math.round((evt.loaded / evt.total) * 100);
          // Keep within 1–99 during transfer; caller will set 100 on completion
          const clamped = Math.max(1, Math.min(99, raw));
          onProgress(clamped);
        }
      }
    });
    return { success: true, file: res.data.data as UploadedFile };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message || 'Upload failed' };
  }
}

export async function listUploads(filters: UploadListFilters = {}): Promise<UploadedFile[]> {
  const res = await axios.get(`${API_BASE_URL}/uploads`, {
    headers: { Authorization: getAuthToken() },
    params: filters.fileId ? { fileId: filters.fileId } : undefined,
  });
  // Assume backend returns { data: UploadedFile[] }
  return (res.data?.data as UploadedFile[]) || [];
}

export async function downloadUpload(fileId: string): Promise<Blob> {
  const res = await axios.get(`${API_BASE_URL}/uploads/${fileId}/download`, {
    headers: { Authorization: getAuthToken() },
    responseType: 'blob'
  });
  return res.data as Blob;
}

export async function getClaimsByUpload(fileId: string, filters: ClaimsByUploadFilters = {}) {
  const { page = 1, limit = 20, claimId, patientName, status } = filters;
  const params: any = { page, limit };
  if (claimId) params.claimId = claimId;
  if (patientName) params.patientName = patientName;
  if (status) params.status = status;
  const res = await axios.get(`${API_BASE_URL}/uploads/${fileId}/claims`, {
    headers: { Authorization: getAuthToken() },
    params
  });
  // Expect { data, totalCount, page, limit, totalPages }
  return res.data;
}

// Fetch all claims across all uploads with optional filters
export async function getAllClaims(filters: Partial<SearchFilters> & { page?: number; limit?: number } = {}): Promise<PaginatedClaimsResponse> {
  const { page = 1, limit = 20, ...rest } = filters;
  const params: any = { page, limit, ...rest };
  const res = await axios.get(`${API_BASE_URL}/claims`, {
    headers: { Authorization: getAuthToken() },
    params,
  });
  return res.data as PaginatedClaimsResponse;
}

// New: Fetch all submit claims (real data) across all uploads
export async function getAllSubmitClaims(filters: { page?: number; limit?: number; claimId?: string; patientName?: string; status?: string; clinicName?: string } = {}): Promise<PaginatedClaimsResponse> {
  const { page = 1, limit = 20, ...rest } = filters;
  const params: any = { page, limit, ...rest };
  const res = await axios.get(`${API_BASE_URL}/submit-uploads/claims`, {
    headers: { Authorization: getAuthToken() },
    params,
  });
  return res.data as PaginatedClaimsResponse;
}

// New: get full submit claim record by id
export async function getSubmitClaimById(id: string | number): Promise<any> {
  const res = await axios.get(`${API_BASE_URL}/submit-uploads/claims/${id}`, {
    headers: { Authorization: getAuthToken() },
  });
  return res.data?.data;
}

export async function deleteUpload(fileId: string): Promise<{ success: boolean; message?: string }>{
  try {
    await axios.delete(`${API_BASE_URL}/uploads/${fileId}`, {
      headers: { Authorization: getAuthToken() },
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, message: e?.response?.data?.message || e.message || 'Delete failed' };
  }
}

export async function getUploadValidationReport(fileId: string): Promise<string[]> {
  try {
    const res = await axios.get(`${API_BASE_URL}/uploads/${fileId}/validation`, {
      headers: { Authorization: getAuthToken() },
    });
    // Expect { data: string[] }
    return (res.data?.data as string[]) || [];
  } catch {
    return [];
  }
}

export async function getUploadPreview(fileId: string, limit: number = 100): Promise<{ headers: string[]; rows: any[]; totalRows: number; totalPreviewRows: number; filename: string }> {
  try {
    const res = await axios.get(`${API_BASE_URL}/uploads/${fileId}/preview`, {
      headers: { Authorization: getAuthToken() },
      params: { limit }
    });
    return res.data.data;
  } catch (e: any) {
    throw new Error(e?.response?.data?.message || 'Failed to load preview');
  }
}

// Submit Upload (Claims) flow
export type SubmitPreviewResponse = {
  upload_id: string;
  s3_url?: string;
  original_filename?: string;
  row_count: number;
  columns_found: string[];
  missing_required: string[];
  warnings: string[];
  sample_rows: any[];
  can_commit: boolean;
  duplicate_of?: string | null;
  errors?: string[]; // when cannot commit
};

export type SubmitCommitResponse = {
  upload_id: string;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  warnings: string[];
  duration_ms: number;
};

export type SubmitCancelResponse = {
  upload_id: string;
  status: 'FAILED';
};

export async function submitUploadPreview(
  file: File,
  clinic: string,
  onProgress?: (pct: number) => void
): Promise<SubmitPreviewResponse> {
  const form = new FormData();
  form.append('file', file);
  form.append('clinic', clinic);
  const res = await axios.post(`${API_BASE_URL}/submit-uploads/preview`, form, {
    headers: { Authorization: getAuthToken(), 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        const raw = Math.round((evt.loaded / evt.total) * 100);
        const clamped = Math.max(1, Math.min(99, raw));
        onProgress(clamped);
      }
    }
  });
  return res.data;
}

export async function submitUploadCommit(upload_id: string): Promise<SubmitCommitResponse> {
  const res = await axios.post(
    `${API_BASE_URL}/submit-uploads/commit`,
    { upload_id },
    { headers: { Authorization: getAuthToken(), 'Content-Type': 'application/json' } }
  );
  return res.data;
}

export async function submitUploadCancel(upload_id: string): Promise<SubmitCancelResponse> {
  const res = await axios.post(
    `${API_BASE_URL}/submit-uploads/cancel`,
    { upload_id },
    { headers: { Authorization: getAuthToken(), 'Content-Type': 'application/json' } }
  );
  return res.data as SubmitCancelResponse;
}

// New: Submit uploads listing and download-url
export type SubmitUploadListItem = {
  upload_id: string;
  clinic: string;
  file_kind: 'SUBMIT_EXCEL';
  original_filename: string;
  row_count: number | null;
  status: 'PENDING' | 'COMPLETED' | 'COMMITTED' | 'FAILED';
  message: string | null;
  created_by: string | null;
  created_at: string;
  claims_count: number;
};

export async function listSubmitUploads(params: { clinic?: string; limit?: number; offset?: number; status?: string; search?: string } = {}): Promise<{ items: SubmitUploadListItem[]; total: number }>{
  const res = await axios.get(`${API_BASE_URL}/submit-uploads`, {
    headers: { Authorization: getAuthToken() },
    params,
  });
  return res.data as { items: SubmitUploadListItem[]; total: number };
}

export async function getSubmitUploadDownloadUrl(upload_id: string): Promise<string> {
  const res = await axios.get(`${API_BASE_URL}/submit-uploads/${upload_id}/download-url`, {
    headers: { Authorization: getAuthToken() },
  });
  return res.data.url as string;
}

export async function pollSubmitProgress(upload_id: string): Promise<{ status: string; row_count: number | null; message: string | null; percent: number | null; done: boolean }>{
  const res = await axios.get(`${API_BASE_URL}/submit-uploads/${upload_id}/progress`, {
    headers: { Authorization: getAuthToken() },
  });
  return res.data;
}

export type ServerPreview = {
  upload_id: string;
  original_filename?: string;
  sheet_names: string[];
  columns: string[];
  rows: any[];
};

export async function getSubmitServerPreview(upload_id: string, rows = 500): Promise<ServerPreview> {
  const res = await axios.get(`${API_BASE_URL}/submit-uploads/${upload_id}/preview`, {
    headers: { Authorization: getAuthToken() },
    params: { rows }
  });
  return res.data as ServerPreview;
}
