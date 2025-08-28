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
          onProgress(Math.round((evt.loaded / evt.total) * 100));
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
