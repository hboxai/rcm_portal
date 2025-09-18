import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, Loader2, Download, Trash2, FileText, Calendar, Hash, AlertCircle, CheckCircle, X, Eye } from 'lucide-react';
import { downloadUpload, listUploads, uploadMetabaseExport, deleteUpload, getUploadValidationReport, submitUploadPreview, submitUploadCommit, listSubmitUploads, getSubmitUploadDownloadUrl, submitUploadCancel, pollSubmitProgress } from '../services/uploadService';
import type { SubmitUploadListItem } from '../services/uploadService';
import { UploadedFile } from '../types/file';
import { trackEvent } from '../utils/audit';
import * as XLSX from 'xlsx';

const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  // Upload state
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Files list state
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showValidation, setShowValidation] = useState(false);
  const [validationLines, setValidationLines] = useState<string[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState<null | { id: string; filename: string }>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Quick Submit preview/commit state
  const [quickClinic, setQuickClinic] = useState('default');
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
  }>(null);
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [quickProgress, setQuickProgress] = useState(0);
  const [commitWarnings, setCommitWarnings] = useState<string[]>([]);
  const [commitDone, setCommitDone] = useState(false);
  const [commitSummary, setCommitSummary] = useState<null | { inserted: number; updated: number; skipped: number }>(null);
  const progressTimerRef = useRef<number | null>(null);
  // Upload smoothing timer & target (to avoid instant jump to 99%)
  const uploadTimerRef = useRef<number | null>(null);
  const uploadTargetRef = useRef<number>(1);
  // Quick preview upload smoothing
  const quickUploadTimerRef = useRef<number | null>(null);
  const quickTargetRef = useRef<number>(1);
  // (Removed submit uploads list state)
  // Submit uploads list & preview state
  const [submitUploads, setSubmitUploads] = useState<SubmitUploadListItem[]>([]);
  const [loadingSubmitUploads, setLoadingSubmitUploads] = useState(false);
  const [suError, setSuError] = useState<string | null>(null);
  // (Removed modal-based submit preview state)

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch uploads list
  const refreshUploads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listUploads();
      setFiles(data.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()));
    } catch (e: any) {
      setError('Failed to load uploads');
    } finally {
      setLoading(false);
    }
  }, []);

  // (Removed refreshSubmitUploads)
  const refreshSubmitUploads = useCallback(async () => {
    setLoadingSubmitUploads(true); setSuError(null);
    try {
      const { items } = await listSubmitUploads({ limit: 50 });
      setSubmitUploads(items);
    } catch (e: any) {
      setSuError(e?.message || 'Failed to load submit uploads');
    } finally {
      setLoadingSubmitUploads(false);
    }
  }, []);

  useEffect(() => {
    refreshUploads();
  void refreshSubmitUploads();
  }, [refreshUploads]);

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

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (fileList: File[]) => {
    const validFiles = fileList.filter(f => /\.(csv|xlsx|xls)$/i.test(f.name));
    if (validFiles.length === 0) {
      setError('Only .csv, .xlsx and .xls files are accepted.');
      return;
    }

    setError(null);
    setSuccess(null);
    setUploading(true);
    // initialize displayed progress and target at 1%
    setProgress(1);
    uploadTargetRef.current = 1;

    try {
      for (const file of validFiles) {
        // restart smoothing animator per file
        if (uploadTimerRef.current) { window.clearInterval(uploadTimerRef.current); uploadTimerRef.current = null; }
        setProgress(1);
        uploadTargetRef.current = 1;
    uploadTimerRef.current = window.setInterval(() => {
          setProgress((p) => {
            const target = uploadTargetRef.current;
            if (p >= target) return p;
      // Ease towards target similar to commit animation (~3% of remaining)
      const step = Math.max(1, Math.round((target - p) * 0.03));
            return Math.min(target, p + step);
          });
    }, 150);

        trackEvent('upload:start', { name: file.name, size: file.size });
        const result = await uploadMetabaseExport(file, (pct) => {
          // update the target, animator will smoothly catch up
          const clamped = Math.max(1, Math.min(99, pct));
          if (clamped > uploadTargetRef.current) uploadTargetRef.current = clamped;
        });
        
        if (!result.success) {
          setError(result.message || 'Upload failed');
          break;
        }
        
        trackEvent('upload:success', { id: result.file?.id, name: file.name });
        setSuccess(`Successfully uploaded ${file.name}`);
        // complete: jump target to 100, snap and hold briefly like commit animation
        uploadTargetRef.current = 100;
        setProgress(100);
  await new Promise(r => setTimeout(r, 300));
        
        // Refresh the uploads list
        await refreshUploads();
      }
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      if (uploadTimerRef.current) { window.clearInterval(uploadTimerRef.current); uploadTimerRef.current = null; }
      setUploading(false);
      setProgress(0);
    }
  };

  // Quick Submit flow: run submit preview immediately when user selects a single file with Alt held or when clicking special button
  const handleQuickSelect = () => fileInputRef.current?.click();
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
        duplicate_of: prev.duplicate_of ?? null,
        can_commit: !!prev.can_commit,
        s3_url: prev.s3_url,
      });
      trackEvent('submit:preview', { id: prev.upload_id, can_commit: prev.can_commit });
    } catch (e: any) {
      setError(e?.message || 'Quick preview failed');
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
        } catch (error) {
          console.warn('Progress polling error:', error);
        }
      }, 200); // Poll every 200ms for more responsive updates
    };

    startPolling();

    try {
      const r = await submitUploadCommit(quickPreview.upload_id);
      setCommitWarnings(r.warnings || []);
      setCommitDone(true);
      setCommitSummary({ inserted: r.inserted_count, updated: r.updated_count, skipped: r.skipped_count });
      setSuccess(`Claims committed: inserted ${r.inserted_count}, updated ${r.updated_count}, skipped ${r.skipped_count}`);
      await refreshUploads();
      await refreshSubmitUploads();
      trackEvent('submit:commit', { id: r.upload_id, inserted: r.inserted_count, updated: r.updated_count });
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
      const result = await deleteUpload(fileId);
      if (result.success) {
        setSuccess(`Successfully deleted ${filename}`);
        trackEvent('upload:delete', { id: fileId });
        await refreshUploads();
      } else {
        setError(result.message || 'Delete failed');
      }
    } catch (e: any) {
      setError('Failed to delete file');
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      trackEvent('upload:download', { id: fileId });
      const blob = await downloadUpload(fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError('Failed to download file');
    }
  };

  const handlePreview = (file: UploadedFile) => {
    trackEvent('upload:preview:navigate', { id: file.id });
    navigate(`/preview/${file.id}`);
  };

  const handleValidation = async (fileId: string) => {
    try {
      const lines = await getUploadValidationReport(fileId);
      setValidationLines(lines);
      setShowValidation(true);
      trackEvent('upload:validation:view', { id: fileId });
    } catch (e: any) {
      setError('Failed to load validation report');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'processed': return 'bg-green-100 text-green-800 border-green-200';
      case 'processing': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'processed': return <CheckCircle size={16} />;
      case 'processing': return <Loader2 size={16} className="animate-spin" />;
      case 'failed': return <AlertCircle size={16} />;
      default: return <FileText size={16} />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Submit uploads status chip styles
  const submitStatusClasses = (status: string) => {
    switch (status) {
      case 'FAILED': return { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-600' };
      case 'COMMITTED': return { text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-600' };
      case 'COMPLETED': return { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-600' };
      default: return { text: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-600' };
    }
  };

  return (
    <div className="container mx-auto px-6 pt-28 pb-12 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold text-textDark">File Upload Center</h1>
      </div>

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
                  Quick Submit: choose an Excel/CSV and we'll preview it automatically.{' '}
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
            <div>
              <div className="font-semibold text-textDark">Submit Preview</div>
              <div className="text-sm text-textDark/70">{quickPreview.original_filename || 'Selected file'} · Rows: {quickPreview.row_count}</div>
              {quickPreview.duplicate_of && (
                <div className="text-xs text-textDark/60 mt-1">Duplicate of upload {quickPreview.duplicate_of}</div>
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

      {/* Files List (shows Submit Uploads) */}
      <div className="rounded-lg border border-purple/20 bg-white shadow-sm">
        <div className="p-5 border-b border-purple/20 flex items-center justify-between bg-gradient-to-r from-white to-purple/5 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-purple/10 text-purple border border-purple/20"><FileText size={18} /></div>
            <div>
              <div className="text-lg font-semibold text-textDark">Submit Uploads</div>
              <div className="text-xs text-textDark/60">Recently uploaded submit files</div>
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
                <th className="px-4 py-3 text-left">Rows</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingSubmitUploads ? (
                <tr><td colSpan={7} className="px-6 py-6 text-center text-textDark/60"><Loader2 className="inline animate-spin mr-2"/>Loading…</td></tr>
              ) : submitUploads.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-textDark/60">No submit uploads found.</td></tr>
              ) : submitUploads.map(u => (
                <tr className="border-t border-textDark/10 hover:bg-purple/5 transition-colors" key={u.upload_id}>
                  <td className="px-4 py-3 align-top font-mono text-xs text-textDark/80">{u.upload_id}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-textDark font-medium truncate max-w-[32ch]" title={u.original_filename}>{u.original_filename}</div>
                    <div className="text-xs text-textDark/60">SUBMIT_EXCEL</div>
                  </td>
                  <td className="px-4 py-3 align-top"><span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs border border-gray-200">{u.clinic}</span></td>
                  <td className="px-4 py-3 align-top">{u.row_count ?? '—'}</td>
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
                      <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 text-xs" onClick={()=>navigate(`/submit-preview/${u.upload_id}`)}>
                        <Eye size={14} /> Preview
                      </button>
                      <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-green-200 text-green-700 hover:bg-green-50 text-xs" onClick={()=>onSubmitDownload(u.upload_id, u.original_filename)}>
                        <Download size={14} /> Download
                      </button>
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
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50"
            onClick={() => (deletingId ? null : setConfirmDelete(null))}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b">
                <h3 className="text-xl font-semibold text-textDark flex items-center gap-3">
                  <Trash2 size={20} className="text-red-600" />
                  Delete file?
                </h3>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-textDark">You're about to delete:</p>
                <p className="text-textDark font-medium break-all">{confirmDelete.filename}</p>
                <p className="text-textDark/70 text-sm">This action cannot be undone.</p>
              </div>
              <div className="px-6 py-4 border-t flex items-center justify-end gap-3 bg-gray-50">
                <button
                  onClick={() => setConfirmDelete(null)}
                  disabled={!!deletingId}
                  className="px-4 py-2 rounded-md border border-gray-300 text-textDark hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete.id, confirmDelete.filename)}
                  disabled={!!deletingId}
                  className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {deletingId ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  {deletingId ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UploadPage;
