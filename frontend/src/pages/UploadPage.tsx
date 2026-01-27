import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UploadCloud, Loader2, Download, Trash2, FileText, AlertCircle, CheckCircle, X, Eye } from 'lucide-react';
import { downloadUpload, listUploads, deleteUpload, getUploadValidationReport, submitUploadPreview, submitUploadCommit, listSubmitUploads, getSubmitUploadDownloadUrl, submitUploadCancel, pollSubmitProgress, deleteSubmitUpload, getSubmitUploadDeleteImpact, listReimburseUploads, reimburseUploadPreview, reimburseUploadCommit } from '../services/uploadService';
import type { SubmitUploadListItem } from '../services/uploadService';
import { UploadedFile } from '../types/file';
import { trackEvent } from '../utils/audit';
 
import * as _XLSX from 'xlsx';
import ConfirmPinkModal from '../components/ui/ConfirmPinkModal';
import { useAuth } from '../contexts/AuthContext';

const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uploadType = searchParams.get('type') || 'submit'; // default to submit
  
  // Determine page title and labels based on upload type
  const isReimburse = uploadType === 'reimburse';
  const pageTitle = isReimburse ? 'Upload Reimburse File' : 'Upload Submit File';
  const fileTypeLabel = isReimburse ? 'Reimburse' : 'Submit';
  // Upload state
  const [dragOver, setDragOver] = useState(false);
  const [uploading, _setUploading] = useState(false);
  const [progress, _setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Files list state
  const [_files, setFiles] = useState<UploadedFile[]>([]);
  const [_loading, setLoading] = useState(true);
  const [showValidation, setShowValidation] = useState(false);
  const [validationLines, setValidationLines] = useState<string[]>([]);
  const [_selectedFileId, _setSelectedFileId] = useState<string | null>(null);
  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState<null | { id: string; filename: string }>(null);
  const [deleteContext, setDeleteContext] = useState<null | 'generic' | 'submit'>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<null | { submit_claims: number; reimburse_rows: number }>(null);
  const { isAdmin } = useAuth();
  // Quick Submit preview/commit state
  const [quickClinic, _setQuickClinic] = useState('default');
  const [quickPreview, setQuickPreview] = useState<null | {
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
      errors: Array<{row: number; field: string; message: string}>;
    };
    note?: string;
  }>(null);
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [quickProgress, setQuickProgress] = useState(0);
  const [commitWarnings, setCommitWarnings] = useState<string[]>([]);
  const [commitDone, setCommitDone] = useState(false);
  const [commitSummary, setCommitSummary] = useState<null | { inserted: number; updated: number; skipped: number }>(null);
  const progressTimerRef = useRef<number | null>(null);
  // Upload smoothing timer & target (to avoid instant jump to 99%)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const uploadTimerRef = useRef<number | null>(null);
  const _uploadTargetRef = useRef<number>(1);
  // Quick preview upload smoothing
  const quickUploadTimerRef = useRef<number | null>(null);
  const quickTargetRef = useRef<number>(1);
  // (Removed submit uploads list state)
  // Submit uploads list & preview state
  const [submitUploads, setSubmitUploads] = useState<SubmitUploadListItem[]>([]);
  const [loadingSubmitUploads, setLoadingSubmitUploads] = useState(false);
  const [suError, setSuError] = useState<string | null>(null);
  // (Removed modal-based submit preview state)
  
  // Case 16: Concurrent upload warning using localStorage
  const [concurrentWarning, setConcurrentWarning] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Case 16: Monitor localStorage for concurrent uploads
  useEffect(() => {
    const checkConcurrentUploads = () => {
      const uploadInProgress = localStorage.getItem('uploadInProgress');
      if (uploadInProgress) {
        const data = JSON.parse(uploadInProgress);
        const timeDiff = Date.now() - data.timestamp;
        // Show warning if another tab has an upload less than 5 minutes old
        if (timeDiff < 5 * 60 * 1000 && data.tabId !== sessionStorage.getItem('tabId')) {
          setConcurrentWarning(true);
        } else {
          setConcurrentWarning(false);
        }
      } else {
        setConcurrentWarning(false);
      }
    };
    
    // Generate unique tab ID
    if (!sessionStorage.getItem('tabId')) {
      sessionStorage.setItem('tabId', `tab-${Date.now()}-${Math.random()}`);
    }
    
    // Check on mount and listen for storage events
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
    } catch (_e: any) {
      setError('Failed to load uploads');
    } finally {
      setLoading(false);
    }
  }, []);

  // (Removed refreshSubmitUploads)
  const refreshSubmitUploads = useCallback(async () => {
    setLoadingSubmitUploads(true); setSuError(null);
    try {
      if (isReimburse) {
        const { items } = await listReimburseUploads({ limit: 50 });
        setSubmitUploads(items);
      } else {
        const { items } = await listSubmitUploads({ limit: 50 });
        setSubmitUploads(items);
      }
    } catch (e: any) {
      setSuError(e?.message || `Failed to load ${fileTypeLabel.toLowerCase()} uploads`);
    } finally {
      setLoadingSubmitUploads(false);
    }
  }, []);

  useEffect(() => {
    refreshUploads();
  void refreshSubmitUploads();
  }, [refreshUploads]);

  // When opening delete modal for submit upload, fetch impact counts
  useEffect(() => {
    (async () => {
      if (deleteContext === 'submit' && confirmDelete?.id) {
        try {
          const data = await getSubmitUploadDeleteImpact(confirmDelete.id);
          setDeleteImpact({ submit_claims: data.submit_claims, reimburse_rows: data.reimburse_rows });
        } catch {
          setDeleteImpact(null);
        }
      } else {
        setDeleteImpact(null);
      }
    })();
  }, [confirmDelete?.id, deleteContext]);

  // Handle ESC key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showValidation) setShowValidation(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showValidation]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(Array.from(e.dataTransfer.files));
    }
  };

  const handleQuickSelect = () => {
    fileInputRef.current?.click();
  };

  const handleDownloadTemplate = async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      const url = `${API_BASE}/submit-uploads/template`;
      
      // Create a hidden anchor element and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = 'submit_claims_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccess('Template downloaded successfully!');
      trackEvent('submit:template_downloaded', {});
    } catch (_e: any) {
      setError('Failed to download template');
    }
  };

  const handleUpload = async (fileList: File[]) => {
    const validFiles = fileList.filter(f => /\.(csv|xlsx|xls)$/i.test(f.name));
    if (validFiles.length === 0) {
      setError('Only .csv, .xlsx and .xls files are accepted.');
      return;
    }

    // Both submit and reimburse now use the quick preview-commit flow
    for (const file of validFiles) {
      await onQuickFileChange([file] as any);
    }
  };

  // Quick Submit flow: run submit preview immediately when user selects a single file with Alt held or when clicking special button
  const onQuickFileChange = async (files?: FileList | null) => {
    const f = files && files[0];
    if (!f) return;
    if (!/\.(csv|xlsx|xls)$/i.test(f.name)) { setError('Only .csv, .xlsx and .xls files are accepted.'); return; }
    setError(null); setSuccess(null);
  setQuickPreview(null);
  setCommitDone(false);
  setCommitSummary(null);
    setQuickSubmitting(true);
    setQuickProgress(1);
    // start smoothing towards upload progress target
    if (quickUploadTimerRef.current) { window.clearInterval(quickUploadTimerRef.current); quickUploadTimerRef.current = null; }
    quickTargetRef.current = 1;
    quickUploadTimerRef.current = window.setInterval(() => {
      setQuickProgress((p) => {
        const target = quickTargetRef.current;
        if (p >= target) return p;
        const step = Math.max(1, Math.round((target - p) * 0.03));
        return Math.min(target, p + step);
      });
    }, 150);
    try {
      if (isReimburse) {
        // Reimburse upload flow - NEW preview-commit pattern
        const prev = await reimburseUploadPreview(f, (pct) => {
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
          s3_url: undefined,
          validation_summary: {
            total_rows: prev.row_count || 0,
            rows_checked: prev.row_count || 0,
            valid_rows: prev.valid_count || 0,
            rows_with_errors: prev.invalid_count || 0,
            error_count: prev.invalid_count || 0,
            errors: []
          }
        });
        trackEvent('reimburse:preview', { id: prev.upload_id, can_commit: prev.can_commit });
      } else {
        // Submit upload flow
        const prev = await submitUploadPreview(f, quickClinic, (pct) => {
          // update target; animator will smoothly catch up
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
          note: prev.note
        });
        trackEvent('submit:preview', { id: prev.upload_id, can_commit: prev.can_commit });
      }
    } catch (e: any) {
  setError(e?.message || (isReimburse ? 'Reimburse upload failed' : 'Quick preview failed'));
    } finally {
  // Ensure 100% completion is visible briefly
  quickTargetRef.current = 100;
  setQuickProgress(100);
  if (quickUploadTimerRef.current) { window.clearInterval(quickUploadTimerRef.current); quickUploadTimerRef.current = null; }
  setTimeout(() => setQuickSubmitting(false), 250);
    }
  };

  const runQuickCommit = async () => {
    if (!quickPreview) return;
    setQuickSubmitting(true);
    setQuickProgress(0);
    setCommitDone(false);
    setCommitSummary(null);
    
    // Clear any existing progress timer
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    // Start real-time progress polling immediately
    const startPolling = () => {
      progressTimerRef.current = window.setInterval(async () => {
        try {
          if (!quickPreview) return;
          const pr = await pollSubmitProgress(quickPreview.upload_id);
          
          // Update progress based on real backend data
          if (typeof pr.percent === 'number') {
            setQuickProgress(Math.max(0, Math.min(100, pr.percent)));
          }
          
          // Stop polling when complete
          if (pr.done || pr.status === 'COMPLETED' || pr.status === 'FAILED') {
            setQuickProgress(pr.status === 'FAILED' ? (pr.percent ?? 0) : 100);
            if (progressTimerRef.current) {
              window.clearInterval(progressTimerRef.current);
              progressTimerRef.current = null;
            }
          }
        } catch (error: any) {
          // Backoff on rate limiting to avoid 429 spam
          const status = error?.response?.status || error?.status;
          if (status === 429) {
            if (progressTimerRef.current) {
              window.clearInterval(progressTimerRef.current);
              progressTimerRef.current = null;
            }
            // Wait 3 seconds before resuming polling after rate limit
            setTimeout(() => {
              if (!progressTimerRef.current) startPolling();
            }, 3000);
          } else {
            console.warn('Progress polling error:', error);
          }
        }
      }, 500); // Poll every 500ms - balanced for real-time feel without hitting rate limits
    };

    startPolling();

    try {
      if (isReimburse) {
        // Reimburse commit flow
        const r = await reimburseUploadCommit(quickPreview.upload_id);
        setCommitWarnings(r.warnings || []);
        setCommitDone(true);
        setCommitSummary({ inserted: r.inserted_count, updated: r.updated_count, skipped: r.skipped_count });
        setSuccess(`Reimburse committed: inserted ${r.inserted_count}, updated ${r.updated_count}, skipped ${r.skipped_count}`);
        await refreshUploads();
        await refreshSubmitUploads();
        trackEvent('reimburse:commit', { id: r.upload_id, inserted: r.inserted_count, updated: r.updated_count });
      } else {
        // Submit commit flow
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
      // Ensure cleanup
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      
      // Brief delay to show 100% completion
      setTimeout(() => {
        setQuickSubmitting(false);
        setQuickProgress(0);
      }, 500);
    }
  };

  // (Removed submit uploads actions)
  // Submit uploads actions
  const onSubmitDownload = async (upload_id: string, filename: string) => {
    try {
      const url = await getSubmitUploadDownloadUrl(upload_id);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.rel='noopener'; a.click();
      trackEvent('submit:download', { id: upload_id });
    } catch (e: any) {
      setSuError(e?.response?.status === 410 ? 'File missing from S3.' : 'Download failed');
    }
  };

  const handleDelete = async (fileId: string, filename: string) => {
    // Called after user confirms in modal
    setDeletingId(fileId);
    try {
      let result: { success: boolean; message?: string } = { success: false };
      if (deleteContext === 'submit') {
        result = await deleteSubmitUpload(fileId);
      } else {
        result = await deleteUpload(fileId);
      }
      if (result.success) {
        setSuccess(`Successfully deleted ${filename}`);
        trackEvent(deleteContext === 'submit' ? 'submit:delete' : 'upload:delete', { id: fileId });
        if (deleteContext === 'submit') {
          await refreshSubmitUploads();
        } else {
          await refreshUploads();
        }
      } else {
        setError(result.message || 'Delete failed');
      }
    } catch (_e: any) {
      setError('Failed to delete file');
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
      setDeleteContext(null);
    }
  };

   
  const _handleDownload = async (fileId: string, filename: string) => {
    try {
      trackEvent('upload:download', { id: fileId });
      const blob = await downloadUpload(fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (_e: any) {
      setError('Failed to download file');
    }
  };

   
  const _handlePreview = (file: UploadedFile) => {
    trackEvent('upload:preview:navigate', { id: file.id });
    navigate(`/preview/${file.id}`);
  };

   
  const _handleValidation = async (fileId: string) => {
    try {
      const lines = await getUploadValidationReport(fileId);
      setValidationLines(lines);
      setShowValidation(true);
      trackEvent('upload:validation:view', { id: fileId });
    } catch (_e: any) {
      setError('Failed to load validation report');
    }
  };

   
  const _getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'processed': return 'bg-green-100 text-green-800 border-green-200';
      case 'processing': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

   
  const _getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'processed': return <CheckCircle size={16} />;
      case 'processing': return <Loader2 size={16} className="animate-spin" />;
      case 'failed': return <AlertCircle size={16} />;
      default: return <FileText size={16} />;
    }
  };

   
  const _formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Submit uploads status chip styles
  const submitStatusClasses = (status: string) => {
    switch (status) {
      case 'FAILED': return { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-600' };
      case 'COMMITTED': return { text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-600' };
      case 'COMPLETED': return { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-600' };
      case 'ROLLED_BACK': return { text: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-600' };
      default: return { text: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-600' };
    }
  };

  return (
    <div className="container mx-auto px-6 pt-28 pb-12 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold text-textDark">{pageTitle}</h1>
      </div>

      {/* Case 11: Processing Upload Alert */}
      {submitUploads.some(u => u.status === 'PROCESSING') && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-blue-50 border border-blue-300 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <Loader2 className="text-blue-600 animate-spin mt-0.5" size={20} />
            <div className="flex-1">
              <div className="font-semibold text-blue-800">Upload in Progress</div>
              <div className="text-sm text-blue-700 mt-1">
                {submitUploads.find(u => u.status === 'PROCESSING')?.original_filename || 'A file'} is currently being processed. 
                Please wait for it to complete before uploading another file.
              </div>
              {submitUploads.find(u => u.status === 'PROCESSING')?.message && (
                <div className="text-xs text-blue-600 mt-2 italic">
                  {submitUploads.find(u => u.status === 'PROCESSING')?.message}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Case 16: Concurrent Upload Warning */}
      {concurrentWarning && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="text-amber-600 mt-0.5" size={20} />
            <div className="flex-1">
              <div className="font-semibold text-amber-800">Upload in Another Tab</div>
              <div className="text-sm text-amber-700 mt-1">
                You have an upload in progress in another tab or window. Concurrent uploads may cause conflicts.
                Please complete or cancel the other upload before starting a new one.
              </div>
            </div>
            <button
              onClick={() => setConcurrentWarning(false)}
              className="text-amber-600 hover:text-amber-800"
            >
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}

      {/* Error/Success Messages */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2"
          >
            <AlertCircle className="text-red-500" size={20} />
            <span className="text-red-700">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
              <X size={16} />
            </button>
          </motion.div>
        )}
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2"
          >
            <CheckCircle className="text-green-500" size={20} />
            <span className="text-green-700">{success}</span>
            <button onClick={() => setSuccess(null)} className="ml-auto text-green-500 hover:text-green-700">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Upload Area */}
      <div className="mb-8">
        {/* Template Download Button */}
        {!isReimburse && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple border border-purple rounded-lg hover:bg-purple/5 transition-colors"
            >
              <Download size={16} />
              Download Excel Template
            </button>
          </div>
        )}
        <div
          className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            dragOver ? 'border-purple bg-purple/5' : 'border-gray-300 hover:border-purple/50'
          } ${uploading ? 'pointer-events-none opacity-75' : ''}`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => onQuickFileChange(e.target.files)}
            className="hidden"
          />
          
          {uploading ? (
            <div className="space-y-4">
              <Loader2 className="mx-auto animate-spin text-purple" size={64} />
              <div className="space-y-3">
                <p className="text-xl text-textDark">Uploading file...</p>
        <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
          className="bg-purple h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-lg text-textDark/60">{progress}%</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <UploadCloud className="mx-auto text-purple" size={64} />
              <div>
                <p className="text-xl text-textDark mb-3">
                  Quick {fileTypeLabel}: choose an Excel/CSV and we'll preview it automatically.{' '}
                  <button
                    onClick={handleQuickSelect}
                    className="text-purple hover:text-purple/80 underline font-medium"
                  >
                    browse
                  </button>
                </p>
                <p className="text-base text-textDark/60">
                  Supports .csv, .xlsx, and .xls files
                </p>
                {/* Clinic selection removed per request; default clinic is used internally */}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Submit Preview / Progress */}
  {quickSubmitting && !quickPreview && (
        <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
          <div className="flex items-center gap-3 mb-2"><Loader2 className="animate-spin text-blue-600" size={18}/> <div className="font-medium text-textDark">Uploading & analyzing…</div></div>
          <div className="w-full max-w-xl">
    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
      <div className="bg-purple h-2 rounded-full transition-all" style={{ width: `${quickProgress}%` }} />
            </div>
            <div className="text-xs mt-1 text-textDark/70">{quickProgress}%</div>
          </div>
        </div>
      )}

      {/* Quick Submit Preview Card */}
      {quickPreview && (
        <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="font-semibold text-textDark">Submit Preview</div>
              <div className="text-sm text-textDark/70">{quickPreview.original_filename || 'Selected file'} · Rows: {quickPreview.row_count}</div>
              {quickPreview.duplicate_of && (
                <div className="text-xs text-textDark/60 mt-1">Duplicate of upload {quickPreview.duplicate_of}</div>
              )}
              {quickPreview.note && (
                <div className="text-xs text-blue-600 mt-1 font-medium">{quickPreview.note}</div>
              )}
              
              {/* Validation Summary Stats */}
              {quickPreview.validation_summary && (
                <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
                  <div className="text-sm font-semibold text-textDark mb-2">Validation Summary</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-textDark/70">Total Rows:</span>
                      <span className="font-medium text-textDark">{quickPreview.validation_summary.total_rows}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textDark/70">Sample Validated:</span>
                      <span className="font-medium text-textDark">{quickPreview.validation_summary.rows_checked} rows</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Valid Rows:</span>
                      <span className="font-semibold text-green-700">{quickPreview.validation_summary.valid_rows} / {quickPreview.validation_summary.rows_checked}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-700">Rows with Errors:</span>
                      <span className="font-semibold text-red-700">{quickPreview.validation_summary.rows_with_errors}</span>
                    </div>
                  </div>
                  {quickPreview.validation_summary.rows_checked < quickPreview.validation_summary.total_rows && (
                    <div className="mt-2 text-xs text-blue-600 italic">
                      ℹ️ Preview validated first {quickPreview.validation_summary.rows_checked} rows. Full validation happens during commit.
                    </div>
                  )}
                  
                  {/* Error Details */}
                  {quickPreview.validation_summary.errors && quickPreview.validation_summary.errors.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-xs font-semibold text-red-700 mb-2">
                        Validation Errors (showing first {Math.min(quickPreview.validation_summary.errors.length, 10)})
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {quickPreview.validation_summary.errors.slice(0, 10).map((err, idx) => (
                          <div key={idx} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                            <span className="font-medium">Row {err.row}:</span> {err.field} - {err.message}
                          </div>
                        ))}
                      </div>
                      {quickPreview.validation_summary.errors.length > 10 && (
                        <div className="text-xs text-red-600 mt-2">
                          ...and {quickPreview.validation_summary.errors.length - 10} more errors
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <div className="mt-3">
                <div className="text-sm font-medium text-textDark">Missing headers:</div>
                {quickPreview.missing_required.length ? (
                  <div className="text-sm text-red-700">
                    {quickPreview.missing_required.join(', ')}
                  </div>
                ) : (
                  <div className="text-sm text-green-700">None</div>
                )}
              </div>
            </div>
              <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  if (!quickPreview) return;
                  try {
                    await submitUploadCancel(quickPreview.upload_id);
                    setSuccess('Upload cancelled');
                  } catch (e: any) {
                    setError(e?.response?.data?.error || e?.message || 'Cancel failed');
                  } finally {
                    setQuickPreview(null);
                      setCommitDone(false);
                      setCommitSummary(null);
                    void refreshSubmitUploads();
                  }
                }}
                className="px-4 py-2 rounded-md border border-gray-300 text-textDark hover:bg-gray-50"
              >
                Cancel
              </button>
              <div className="flex flex-col items-stretch gap-2 min-w-[220px]">
                <button
                  onClick={runQuickCommit}
                  disabled={!quickPreview.can_commit || quickSubmitting || commitDone}
                  className={`px-4 py-2 rounded-md text-white disabled:opacity-50 disabled:cursor-not-allowed ${commitDone ? 'bg-green-600' : 'bg-purple'} `}
                >
                  {quickSubmitting ? 'Committing…' : commitDone ? 'Committed' : 'Commit'}
                </button>
                {quickSubmitting && (
                  <div>
                    <div className="w-56 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className="bg-purple h-2 rounded-full transition-all" style={{ width: `${quickProgress}%` }} />
                    </div>
                    <div className="text-[10px] mt-1 text-textDark/70 text-right">{quickProgress}%</div>
                  </div>
                )}
                  {!quickSubmitting && commitDone && (
                    <div className="text-xs text-green-700">Claims committed{commitSummary ? `: +${commitSummary.inserted} / ~${commitSummary.updated} updated` : ''}</div>
                  )}
              </div>
            </div>
          </div>
          {quickPreview.sample_rows?.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    {Object.keys(quickPreview.sample_rows[0]).map((h) => (
                      <th key={h} className="px-2 py-1 text-left border-b text-textDark/80">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quickPreview.sample_rows.slice(0,5).map((r, i) => (
                    <tr key={i} className="odd:bg-white even:bg-white/60">
                      {Object.keys(quickPreview.sample_rows[0]).map((h) => (
                        <td key={h} className="px-2 py-1 border-b text-textDark/80">{String((r as any)[h] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Commit warnings */}
      {commitWarnings.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="font-semibold text-yellow-800 mb-2">Commit Warnings</div>
          <ul className="text-sm text-yellow-800 list-disc pl-5 space-y-1">
            {commitWarnings.slice(0, 10).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          {commitWarnings.length > 10 && (
            <div className="text-xs text-yellow-700 mt-2">…and {commitWarnings.length - 10} more</div>
          )}
        </div>
      )}

      {/* Files List (dynamic based on upload type) */}
      <div className="rounded-lg border border-purple/20 bg-white shadow-sm">
        <div className="p-5 border-b border-purple/20 flex items-center justify-between bg-gradient-to-r from-white to-purple/5 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-purple/10 text-purple border border-purple/20"><FileText size={18} /></div>
            <div>
              <div className="text-lg font-semibold text-textDark">{fileTypeLabel} Uploads</div>
              <div className="text-xs text-textDark/60">Recently uploaded {fileTypeLabel.toLowerCase()} files</div>
            </div>
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple/10 text-purple border border-purple/20">
              {submitUploads.length} items
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded-md border border-purple/30 text-purple hover:bg-purple/10 text-sm" onClick={refreshSubmitUploads}>
              Refresh
            </button>
          </div>
        </div>

        {suError && <div className="px-5 py-2 text-sm text-red-700">{suError}</div>}
        <div className="overflow-x-auto px-5 pb-5">
          <div className="rounded-lg border border-purple/10 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-purple/10 text-textDark/80 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Upload ID</th>
                <th className="px-4 py-3 text-left">Filename</th>
                <th className="px-4 py-3 text-left">Clinic</th>
                <th className="px-4 py-3 text-left">{isReimburse ? 'Reimburse Rows' : 'Rows'}</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingSubmitUploads ? (
                <tr><td colSpan={7} className="px-6 py-6 text-center text-textDark/60"><Loader2 className="inline animate-spin mr-2"/>Loading…</td></tr>
              ) : submitUploads.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-textDark/60">No {fileTypeLabel.toLowerCase()} uploads found.</td></tr>
              ) : submitUploads.map(u => (
                <tr className="border-t border-textDark/10 hover:bg-purple/5 transition-colors" key={u.upload_id}>
                  <td className="px-4 py-3 align-top font-mono text-xs text-textDark/80">{u.upload_id}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-textDark font-medium truncate max-w-[32ch]" title={u.original_filename}>{u.original_filename}</div>
                    <div className="text-xs text-textDark/60">{u.file_kind}</div>
                  </td>
                  <td className="px-4 py-3 align-top"><span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs border border-gray-200">{u.clinic}</span></td>
                  <td className="px-4 py-3 align-top">{isReimburse ? (u as any).reimburse_count ?? '—' : (u.row_count ?? '—')}</td>
                  <td className="px-4 py-3 align-top">
                    {(() => { const s = submitStatusClasses(u.status); return (
                      <span className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.bg} ${s.text} ${s.border}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                        {u.status}
                      </span>
                    ); })()}
                  </td>
                  <td className="px-4 py-3 align-top text-textDark/80">{new Date(u.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      {isReimburse ? (
                        <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 text-xs" onClick={()=>navigate(`/search?upload_id=${u.upload_id}`)}>
                          <Eye size={14} /> View claims
                        </button>
                      ) : (
                        <>
                          <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 text-xs" onClick={()=>navigate(`/submit-preview/${u.upload_id}`)}>
                            <Eye size={14} /> Preview
                          </button>
                          <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-green-200 text-green-700 hover:bg-green-50 text-xs" onClick={()=>onSubmitDownload(u.upload_id, u.original_filename)}>
                            <Download size={14} /> Download
                          </button>
                          {isAdmin && (
                            <button
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-red-200 text-red-700 hover:bg-red-50 text-xs"
                              onClick={()=>{ setConfirmDelete({ id: u.upload_id, filename: u.original_filename }); setDeleteContext('submit'); }}
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

  {/* (Removed Submit file in-app preview modal) */}
  {/* (Removed modal-based submit preview) */}

      {/* Validation Modal */}
      <AnimatePresence>
        {showValidation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50"
            onClick={() => setShowValidation(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b">
                <h3 className="text-xl font-semibold text-textDark flex items-center gap-3">
                  <AlertCircle size={24} />
                  Validation Report
                </h3>
                <button
                  onClick={() => setShowValidation(false)}
                  className="p-2 hover:bg-gray-100 rounded-md"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 overflow-auto max-h-96">
                <pre className="text-sm text-textDark bg-gray-50 p-4 rounded whitespace-pre-wrap">
                  {validationLines.join('\n')}
                </pre>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <ConfirmPinkModal
        isOpen={!!confirmDelete}
        title="Delete file?"
        message={
          <div className="space-y-3 text-base">
            <p>You're about to delete:</p>
            <p className="font-medium break-all">{confirmDelete?.filename}</p>
            <p className="text-sm text-textDark/80">
              {deleteImpact
                ? (
                    <>
                      This will remove <span className="font-semibold">{deleteImpact.submit_claims.toLocaleString()}</span> claim{deleteImpact.submit_claims === 1 ? '' : 's'}
                      {` `}and <span className="font-semibold">{deleteImpact.reimburse_rows.toLocaleString()}</span> related reimburse entr{deleteImpact.reimburse_rows === 1 ? 'y' : 'ies'}.
                      {` `}This action cannot be undone.
                    </>
                  )
                : (
                    <>All claims inserted by this file will also be permanently removed from the system, including any related reimburse entries. This action cannot be undone.</>
                  )}
            </p>
          </div>
        }
        confirmLabel={deletingId ? 'Deleting…' : 'Delete'}
        confirmIcon={deletingId ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        onCancel={() => (!deletingId ? setConfirmDelete(null) : undefined)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete.id, confirmDelete.filename)}
        disabled={!!deletingId}
      />
    </div>
  );
};

export default UploadPage;
