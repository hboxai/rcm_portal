import axios from '../utils/axiosSetup';
import { ERA_API_BASE_URL as API_BASE_URL } from '../config/api';

const authHeader = () => ({ Authorization: localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : '' });

export type EraParsedRow = {
  submit_cpt_id?: string;
  billing_id?: number;
  patient_id?: string;
  cpt_code?: string;
  dos?: string; // YYYY-MM-DD
  prim_amt?: number | null;
  prim_chk_det?: string | null;
  prim_recv_dt?: string | null;
  prim_denial_code?: string | null;
  sec_amt?: number | null;
  sec_chk_det?: string | null;
  sec_recv_dt?: string | null;
  sec_denial_code?: string | null;
  pat_amt?: number | null;
  pat_recv_dt?: string | null;
  allowed_amt?: number | null;
  write_off_amt?: number | null;
  claim_status?: string | null;
  raw_json?: any;
};

export async function ingestParsedRows(eraFileId: number, rows: EraParsedRow[], source_format: string = 'json') {
  const res = await axios.post(`${API_BASE_URL}/era-files/${eraFileId}/parse`, { rows, source_format }, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  });
  return res.data as { success: boolean; batch: any };
}

export async function getLatestParseBatch(eraFileId: number, page = 1, pageSize = 200) {
  const res = await axios.get(`${API_BASE_URL}/era-files/${eraFileId}/parse/latest`, {
    headers: authHeader(),
    params: { page, pageSize },
  });
  return res.data as { batch: any; rows: any[]; total: number; page: number; pageSize: number };
}

export async function markRowsReviewed(batchId: number, rowIds: number[], reviewed: boolean) {
  const res = await axios.post(`${API_BASE_URL}/era-parses/${batchId}/review`, { rowIds, reviewed }, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
  });
  return res.data as { success: boolean };
}

export async function commitParseBatch(batchId: number, onlyReviewed = true) {
  const res = await axios.post(`${API_BASE_URL}/era-parses/${batchId}/commit`, null, {
    headers: authHeader(),
    params: { onlyReviewed },
  });
  return res.data as { success: boolean; stats: { total: number; matched: number; updated: number; notFound: number }; batch: any };
}

// Global ERA files (not tied to a claim)
export type EraFile = {
  id: string;
  claim_id: string | null;
  original_filename: string;
  content_type: string;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
  url: string;
};

export async function uploadEraPdfsGlobal(files: File[]): Promise<EraFile[]> {
  const form = new FormData();
  files.forEach(f => form.append('eraPdfs', f));
  const res = await axios.post(`${API_BASE_URL}/files`, form, {
    headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
  });
  return (res.data?.data || []) as EraFile[];
}

export async function listEraPdfsGlobal(limit = 50): Promise<EraFile[]> {
  const res = await axios.get(`${API_BASE_URL}/files`, {
    headers: authHeader(),
    params: { limit },
  });
  return (res.data?.data || []) as EraFile[];
}

export async function deleteEraPdfGlobal(id: string): Promise<void> {
  await axios.delete(`${API_BASE_URL}/files/${id}`, { headers: authHeader() });
}

export async function autoParseEraPdf(eraFileId: number): Promise<{ batch: any; rowCount: number }> {
  const res = await axios.post(`${API_BASE_URL}/era-files/${eraFileId}/auto-parse`, null, {
    headers: authHeader(),
  });
  return res.data?.data as { batch: any; rowCount: number };
}
