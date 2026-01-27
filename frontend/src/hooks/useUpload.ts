import { useState, useCallback, useRef, useEffect } from 'react';
import {
  listUploads,
  deleteUpload,
  submitUploadPreview,
  submitUploadCommit,
  listSubmitUploads,
  pollSubmitProgress,
  deleteSubmitUpload,
  getSubmitUploadDeleteImpact,
  listReimburseUploads,
  reimburseUploadPreview,
  reimburseUploadCommit,
} from '../services/uploadService';
import type { SubmitUploadListItem } from '../services/uploadService';
import { UploadedFile } from '../types/file';
import { trackEvent } from '../utils/audit';

export interface QuickPreviewData {
  upload_id: string;
  columns_found: string[];
  missing_required: string[];
  sample_rows: any[];
  row_count: number;
  original_filename?: string;
  duplicate_of?: string | null;
  can_commit: boolean;
  s3_url?: string;
  validation_summary?: {
    total_rows: number;
    rows_checked: number;
    valid_rows: number;
    rows_with_errors: number;
    error_count: number;
    errors: Array<{ row: number; field: string; message: string }>;
  };
  note?: string;
}

export interface CommitSummary {
  inserted: number;
  updated: number;
  skipped: number;
}

export interface DeleteImpact {
  submit_claims: number;
  reimburse_rows: number;
}

export interface UseUploadOptions {
  isReimburse: boolean;
}

export interface UseUploadReturn {
  // State
  files: UploadedFile[];
  loading: boolean;
  error: string | null;
  success: string | null;
  submitUploads: SubmitUploadListItem[];
  loadingSubmitUploads: boolean;
  suError: string | null;
  quickPreview: QuickPreviewData | null;
  quickSubmitting: boolean;
  quickProgress: number;
  commitDone: boolean;
  commitSummary: CommitSummary | null;
  commitWarnings: string[];
  deletingId: string | null;
  deleteImpact: DeleteImpact | null;
  concurrentWarning: boolean;
  
  // Setters
  setError: (error: string | null) => void;
  setSuccess: (success: string | null) => void;
  setQuickPreview: (preview: QuickPreviewData | null) => void;
  setCommitDone: (done: boolean) => void;
  setCommitSummary: (summary: CommitSummary | null) => void;
  setConcurrentWarning: (warning: boolean) => void;
  
  // Actions
  refreshUploads: () => Promise<void>;
  refreshSubmitUploads: () => Promise<void>;
  handleUpload: (files: File[]) => Promise<void>;
  onQuickFileChange: (files: FileList | null) => Promise<void>;
  runQuickCommit: () => Promise<void>;
  cancelQuickPreview: () => void;
  handleDelete: (id: string, context: 'generic' | 'submit') => Promise<void>;
  fetchDeleteImpact: (id: string) => Promise<void>;
  resetCommit: () => void;
}

export function useUpload({ isReimburse }: UseUploadOptions): UseUploadReturn {
  // Files state
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Submit uploads state
  const [submitUploads, setSubmitUploads] = useState<SubmitUploadListItem[]>([]);
  const [loadingSubmitUploads, setLoadingSubmitUploads] = useState(false);
  const [suError, setSuError] = useState<string | null>(null);
  
  // Concurrent upload warning
  const [concurrentWarning, setConcurrentWarning] = useState(false);
  
  // Quick preview/commit state
  const [quickPreview, setQuickPreview] = useState<QuickPreviewData | null>(null);
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [quickProgress, setQuickProgress] = useState(0);
  const [commitDone, setCommitDone] = useState(false);
  const [commitSummary, setCommitSummary] = useState<CommitSummary | null>(null);
  const [commitWarnings, setCommitWarnings] = useState<string[]>([]);
  
  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<DeleteImpact | null>(null);
  
  // Refs for timers
  const progressTimerRef = useRef<number | null>(null);
  const quickUploadTimerRef = useRef<number | null>(null);
  const quickTargetRef = useRef<number>(1);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
      if (quickUploadTimerRef.current) window.clearInterval(quickUploadTimerRef.current);
    };
  }, []);
  
  // Monitor localStorage for concurrent uploads
  useEffect(() => {
    const checkConcurrentUploads = () => {
      const uploadInProgress = localStorage.getItem('uploadInProgress');
      if (uploadInProgress) {
        const data = JSON.parse(uploadInProgress);
        const timeDiff = Date.now() - data.timestamp;
        if (timeDiff < 5 * 60 * 1000 && data.tabId !== sessionStorage.getItem('tabId')) {
          setConcurrentWarning(true);
        } else {
          setConcurrentWarning(false);
        }
      } else {
        setConcurrentWarning(false);
      }
    };
    
    if (!sessionStorage.getItem('tabId')) {
      sessionStorage.setItem('tabId', `tab-${Date.now()}-${Math.random()}`);
    }
    
    checkConcurrentUploads();
    window.addEventListener('storage', checkConcurrentUploads);
    const interval = setInterval(checkConcurrentUploads, 3000);
    
    return () => {
      window.removeEventListener('storage', checkConcurrentUploads);
      clearInterval(interval);
    };
  }, []);
  
  // Fetch uploads list
  const refreshUploads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listUploads();
      setFiles(data.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()));
    } catch (_e) {
      setError('Failed to load uploads');
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Fetch submit/reimburse uploads list
  const refreshSubmitUploads = useCallback(async () => {
    setLoadingSubmitUploads(true);
    setSuError(null);
    try {
      if (isReimburse) {
        const { items } = await listReimburseUploads({ limit: 50 });
        setSubmitUploads(items);
      } else {
        const { items } = await listSubmitUploads({ limit: 50 });
        setSubmitUploads(items);
      }
    } catch (e: any) {
      setSuError(e?.message || `Failed to load ${isReimburse ? 'reimburse' : 'submit'} uploads`);
    } finally {
      setLoadingSubmitUploads(false);
    }
  }, [isReimburse]);

  // Load uploads on mount
  useEffect(() => {
    void refreshUploads();
    void refreshSubmitUploads();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Process a single file for preview
  const processFile = useCallback(async (file: File) => {
    setError(null);
    setSuccess(null);
    setQuickPreview(null);
    setCommitDone(false);
    setCommitSummary(null);
    setQuickSubmitting(true);
    setQuickProgress(1);
    
    if (quickUploadTimerRef.current) {
      window.clearInterval(quickUploadTimerRef.current);
    }
    quickTargetRef.current = 1;
    quickUploadTimerRef.current = window.setInterval(() => {
      setQuickProgress(p => {
        const target = quickTargetRef.current;
        if (p >= target) return p;
        const step = Math.max(1, Math.round((target - p) * 0.03));
        return Math.min(target, p + step);
      });
    }, 150);
    
    try {
      if (isReimburse) {
        const prev = await reimburseUploadPreview(file, (pct) => {
          const clamped = Math.max(1, Math.min(99, pct));
          if (clamped > quickTargetRef.current) quickTargetRef.current = clamped;
        });
        
        if (!prev.can_commit) {
          setError(prev.errors?.join('\n') || `Validation failed: ${prev.invalid_count} invalid rows`);
        }
        
        setQuickPreview({
          upload_id: prev.upload_id,
          columns_found: Object.keys(prev.columns_mapped || {}),
          missing_required: prev.errors || [],
          sample_rows: prev.sample_valid || [],
          row_count: prev.row_count || 0,
          original_filename: prev.original_filename,
          duplicate_of: null,
          can_commit: !!prev.can_commit,
          validation_summary: {
            total_rows: prev.row_count || 0,
            rows_checked: prev.row_count || 0,
            valid_rows: prev.valid_count || 0,
            rows_with_errors: prev.invalid_count || 0,
            error_count: prev.invalid_count || 0,
            errors: [],
          },
        });
        trackEvent('reimburse:preview', { id: prev.upload_id, can_commit: prev.can_commit });
      } else {
        const prev = await submitUploadPreview(file, 'default', (pct) => {
          const clamped = Math.max(1, Math.min(99, pct));
          if (clamped > quickTargetRef.current) quickTargetRef.current = clamped;
        });
        
        if (!prev.can_commit) {
          setError(prev.errors?.join('\n') || `Missing required headers: ${prev.missing_required.join(', ')}`);
        }
        
        setQuickPreview({
          upload_id: prev.upload_id,
          columns_found: prev.columns_found || [],
          missing_required: prev.missing_required || [],
          sample_rows: prev.sample_rows || [],
          row_count: prev.row_count || 0,
          original_filename: prev.original_filename,
          duplicate_of: prev.duplicate_of,
          can_commit: !!prev.can_commit,
          s3_url: prev.s3_url,
          validation_summary: prev.validation_summary,
          note: prev.note,
        });
        trackEvent('submit:preview', { id: prev.upload_id, can_commit: prev.can_commit });
      }
    } catch (e: any) {
      setError(e?.message || (isReimburse ? 'Reimburse upload failed' : 'Preview failed'));
    } finally {
      quickTargetRef.current = 100;
      setQuickProgress(100);
      if (quickUploadTimerRef.current) {
        window.clearInterval(quickUploadTimerRef.current);
        quickUploadTimerRef.current = null;
      }
      setTimeout(() => setQuickSubmitting(false), 250);
    }
  }, [isReimburse]);
  
  // Handle file upload with preview
  const handleUpload = useCallback(async (fileList: File[]) => {
    const validFiles = fileList.filter(f => /\.(csv|xlsx|xls)$/i.test(f.name));
    if (validFiles.length === 0) {
      setError('Only .csv, .xlsx and .xls files are accepted.');
      return;
    }
    
    for (const file of validFiles) {
      await processFile(file);
    }
  }, [processFile]);
  
  // Handle file input change
  const onQuickFileChange = useCallback(async (files: FileList | null) => {
    const f = files && files[0];
    if (!f) return;
    if (!/\.(csv|xlsx|xls)$/i.test(f.name)) {
      setError('Only .csv, .xlsx and .xls files are accepted.');
      return;
    }
    await processFile(f);
  }, [processFile]);
  
  // Run commit after preview
  const runQuickCommit = useCallback(async () => {
    if (!quickPreview) return;
    
    setQuickSubmitting(true);
    setQuickProgress(0);
    setCommitDone(false);
    setCommitSummary(null);
    
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    
    const startPolling = () => {
      progressTimerRef.current = window.setInterval(async () => {
        try {
          if (!quickPreview) return;
          const pr = await pollSubmitProgress(quickPreview.upload_id);
          
          if (typeof pr.percent === 'number') {
            setQuickProgress(Math.max(0, Math.min(100, pr.percent)));
          }
          
          if (pr.done || pr.status === 'COMPLETED' || pr.status === 'FAILED') {
            setQuickProgress(pr.status === 'FAILED' ? (pr.percent ?? 0) : 100);
            if (progressTimerRef.current) {
              window.clearInterval(progressTimerRef.current);
              progressTimerRef.current = null;
            }
          }
        } catch (error: any) {
          const status = error?.response?.status || error?.status;
          if (status === 429) {
            if (progressTimerRef.current) {
              window.clearInterval(progressTimerRef.current);
              progressTimerRef.current = null;
            }
            setTimeout(() => {
              if (!progressTimerRef.current) startPolling();
            }, 3000);
          }
        }
      }, 500);
    };
    
    startPolling();
    
    try {
      if (isReimburse) {
        const r = await reimburseUploadCommit(quickPreview.upload_id);
        setCommitWarnings(r.warnings || []);
        setCommitDone(true);
        setCommitSummary({ inserted: r.inserted_count, updated: r.updated_count, skipped: r.skipped_count });
        setSuccess(`Reimburse committed: inserted ${r.inserted_count}, updated ${r.updated_count}, skipped ${r.skipped_count}`);
        await refreshUploads();
        await refreshSubmitUploads();
        trackEvent('reimburse:commit', { id: r.upload_id, inserted: r.inserted_count, updated: r.updated_count });
      } else {
        const r = await submitUploadCommit(quickPreview.upload_id);
        setCommitWarnings(r.warnings || []);
        setCommitDone(true);
        setCommitSummary({ inserted: r.inserted_count, updated: r.updated_count, skipped: r.skipped_count });
        setSuccess(`Claims committed: inserted ${r.inserted_count}, updated ${r.updated_count}, skipped ${r.skipped_count}`);
        await refreshUploads();
        await refreshSubmitUploads();
        trackEvent('submit:commit', { id: r.upload_id, inserted: r.inserted_count, updated: r.updated_count });
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Commit failed');
    } finally {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      setQuickProgress(100);
      setTimeout(() => setQuickSubmitting(false), 250);
    }
  }, [quickPreview, isReimburse, refreshUploads, refreshSubmitUploads]);
  
  // Cancel preview
  const cancelQuickPreview = useCallback(() => {
    setQuickPreview(null);
    setCommitDone(false);
    setCommitSummary(null);
    setCommitWarnings([]);
    setError(null);
    setSuccess(null);
  }, []);
  
  // Reset commit state
  const resetCommit = useCallback(() => {
    setQuickPreview(null);
    setCommitDone(false);
    setCommitSummary(null);
    setCommitWarnings([]);
  }, []);
  
  // Handle delete
  const handleDelete = useCallback(async (id: string, context: 'generic' | 'submit') => {
    setDeletingId(id);
    try {
      if (context === 'submit') {
        await deleteSubmitUpload(id);
        trackEvent('submit:delete', { id });
      } else {
        await deleteUpload(id);
        trackEvent('upload:delete', { id });
      }
      setSuccess('File deleted successfully');
      await refreshUploads();
      await refreshSubmitUploads();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
      setDeleteImpact(null);
    }
  }, [refreshUploads, refreshSubmitUploads]);
  
  // Fetch delete impact
  const fetchDeleteImpact = useCallback(async (id: string) => {
    try {
      const data = await getSubmitUploadDeleteImpact(id);
      setDeleteImpact({ submit_claims: data.submit_claims, reimburse_rows: data.reimburse_rows });
    } catch {
      setDeleteImpact(null);
    }
  }, []);
  
  return {
    files,
    loading,
    error,
    success,
    submitUploads,
    loadingSubmitUploads,
    suError,
    quickPreview,
    quickSubmitting,
    quickProgress,
    commitDone,
    commitSummary,
    commitWarnings,
    deletingId,
    deleteImpact,
    concurrentWarning,
    setError,
    setSuccess,
    setQuickPreview,
    setCommitDone,
    setCommitSummary,
    setConcurrentWarning,
    refreshUploads,
    refreshSubmitUploads,
    handleUpload,
    onQuickFileChange,
    runQuickCommit,
    cancelQuickPreview,
    handleDelete,
    fetchDeleteImpact,
    resetCommit,
  };
}
