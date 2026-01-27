import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle, X, Trash2 } from 'lucide-react';
import {
  deleteUpload,
  getUploadValidationReport,
  submitUploadCancel,
  deleteSubmitUpload,
  getSubmitUploadDeleteImpact,
  getSubmitUploadDownloadUrl,
} from '../services/uploadService';
import { trackEvent } from '../utils/audit';
import ConfirmPinkModal from '../components/ui/ConfirmPinkModal';
import { useAuth } from '../contexts/AuthContext';
import { useUpload } from '../hooks/useUpload';
import { FileDropZone, UploadPreviewPanel, UploadHistoryTable } from '../components/upload';

const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uploadType = searchParams.get('type') || 'submit';
  const isReimburse = uploadType === 'reimburse';
  const fileTypeLabel = isReimburse ? 'Reimburse' : 'Submit';
  const pageTitle = isReimburse ? 'Upload Reimburse File' : 'Upload Submit File';

  const { isAdmin } = useAuth();

  // Use the custom upload hook
  const {
    error,
    setError,
    success,
    setSuccess,
    quickPreview,
    setQuickPreview,
    quickSubmitting,
    quickProgress,
    commitDone,
    setCommitDone,
    commitSummary,
    setCommitSummary,
    commitWarnings,
    submitUploads,
    loadingSubmitUploads,
    suError,
    concurrentWarning,
    setConcurrentWarning,
    onQuickFileChange,
    runQuickCommit,
    refreshSubmitUploads,
  } = useUpload({ isReimburse });

  // Validation modal state (kept local as it's UI-specific)
  const [showValidation, setShowValidation] = useState(false);
  const [validationLines, setValidationLines] = useState<string[]>([]);

  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState<null | { id: string; filename: string }>(null);
  const [deleteContext, setDeleteContext] = useState<null | 'generic' | 'submit'>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<null | { submit_claims: number; reimburse_rows: number }>(null);

  // Fetch delete impact when opening modal for submit uploads
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
      if (e.key === 'Escape' && showValidation) {
        setShowValidation(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showValidation]);

  // Handle file upload
  const handleUpload = useCallback(
    async (files: File[]) => {
      const validFiles = files.filter((f) => /\.(csv|xlsx|xls)$/i.test(f.name));
      if (validFiles.length === 0) {
        setError('Only .csv, .xlsx and .xls files are accepted.');
        return;
      }
      for (const file of validFiles) {
        await onQuickFileChange([file] as unknown as FileList);
      }
    },
    [onQuickFileChange, setError]
  );

  // Handle template download (submit only)
  const handleDownloadTemplate = useCallback(async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      const url = `${API_BASE}/submit-uploads/template`;
      const link = document.createElement('a');
      link.href = url;
      link.download = 'submit_claims_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setSuccess('Template downloaded successfully!');
      trackEvent('submit:template_downloaded', {});
    } catch {
      setError('Failed to download template');
    }
  }, [setError, setSuccess]);

  // Handle download for submit uploads
  const onSubmitDownload = useCallback(
    async (uploadId: string, filename: string) => {
      try {
        const url = await getSubmitUploadDownloadUrl(uploadId);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        a.click();
        trackEvent('submit:download', { id: uploadId });
      } catch (e: any) {
        setError(e?.response?.status === 410 ? 'File missing from S3.' : 'Download failed');
      }
    },
    [setError]
  );

  // Handle delete confirmation
  const handleDelete = useCallback(
    async (fileId: string, filename: string) => {
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
          await refreshSubmitUploads();
        } else {
          setError(result.message || 'Delete failed');
        }
      } catch {
        setError('Failed to delete file');
      } finally {
        setDeletingId(null);
        setConfirmDelete(null);
        setDeleteContext(null);
      }
    },
    [deleteContext, refreshSubmitUploads, setError, setSuccess]
  );

  // Handle cancel preview
  const handleCancelPreview = useCallback(async () => {
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
  }, [quickPreview, refreshSubmitUploads, setCommitDone, setCommitSummary, setError, setQuickPreview, setSuccess]);

  // Handle validation modal
  const handleValidation = useCallback(
    async (fileId: string) => {
      try {
        const lines = await getUploadValidationReport(fileId);
        setValidationLines(lines);
        setShowValidation(true);
        trackEvent('upload:validation:view', { id: fileId });
      } catch {
        setError('Failed to load validation report');
      }
    },
    [setError]
  );

  // Open delete modal for history table
  const handleDeleteClick = useCallback((uploadId: string, filename: string) => {
    setConfirmDelete({ id: uploadId, filename });
    setDeleteContext('submit');
  }, []);

  return (
    <div className="container mx-auto px-6 pt-28 pb-12 min-h-screen">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold text-textDark dark:text-gray-200">{pageTitle}</h1>
      </div>

      {/* Processing Upload Alert */}
      {submitUploads.some((u) => u.status === 'PROCESSING') && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <Loader2 className="text-blue-600 dark:text-blue-400 animate-spin mt-0.5" size={20} />
            <div className="flex-1">
              <div className="font-semibold text-blue-800 dark:text-blue-300">Upload in Progress</div>
              <div className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                {submitUploads.find((u) => u.status === 'PROCESSING')?.original_filename || 'A file'} is
                currently being processed. Please wait for it to complete before uploading another file.
              </div>
              {submitUploads.find((u) => u.status === 'PROCESSING')?.message && (
                <div className="text-xs text-blue-600 dark:text-blue-500 mt-2 italic">
                  {submitUploads.find((u) => u.status === 'PROCESSING')?.message}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Concurrent Upload Warning */}
      {concurrentWarning && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="text-amber-600 dark:text-amber-400 mt-0.5" size={20} />
            <div className="flex-1">
              <div className="font-semibold text-amber-800 dark:text-amber-300">Upload in Another Tab</div>
              <div className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                You have an upload in progress in another tab or window. Concurrent uploads may cause
                conflicts. Please complete or cancel the other upload before starting a new one.
              </div>
            </div>
            <button
              onClick={() => setConcurrentWarning(false)}
              className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
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
            className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg flex items-center gap-2"
          >
            <AlertCircle className="text-red-500 dark:text-red-400" size={20} />
            <span className="text-red-700 dark:text-red-300 whitespace-pre-wrap">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg flex items-center gap-2"
          >
            <CheckCircle className="text-green-500 dark:text-green-400" size={20} />
            <span className="text-green-700 dark:text-green-300">{success}</span>
            <button
              onClick={() => setSuccess(null)}
              className="ml-auto text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-200"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Drop Zone */}
      <div className="mb-8">
        <FileDropZone
          onFilesSelected={handleUpload}
          isUploading={quickSubmitting && !quickPreview}
          uploadProgress={quickProgress}
          fileTypeLabel={fileTypeLabel}
          onDownloadTemplate={!isReimburse ? handleDownloadTemplate : undefined}
        />
      </div>

      {/* Upload Progress (during preview generation) */}
      {quickSubmitting && !quickPreview && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/20 p-4"
        >
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={18} />
            <div className="font-medium text-textDark dark:text-gray-200">Uploading & analyzing…</div>
          </div>
          <div className="w-full max-w-xl">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-purple h-2 rounded-full transition-all"
                style={{ width: `${quickProgress}%` }}
              />
            </div>
            <div className="text-xs mt-1 text-textDark/70 dark:text-gray-400">{quickProgress}%</div>
          </div>
        </motion.div>
      )}

      {/* Preview Panel */}
      {quickPreview && (
        <UploadPreviewPanel
          preview={quickPreview}
          isReimburse={isReimburse}
          isSubmitting={quickSubmitting}
          commitDone={commitDone}
          commitSummary={commitSummary}
          progress={quickProgress}
          commitWarnings={commitWarnings}
          error={error}
          onCommit={runQuickCommit}
          onCancel={handleCancelPreview}
          onUploadAnother={() => {
            setQuickPreview(null);
            setCommitDone(false);
            setCommitSummary(null);
          }}
        />
      )}

      {/* Upload History Table */}
      <UploadHistoryTable
        uploads={submitUploads}
        loading={loadingSubmitUploads}
        error={suError}
        isReimburse={isReimburse}
        isAdmin={isAdmin}
        onDownload={onSubmitDownload}
        onDelete={handleDeleteClick}
        onRefresh={refreshSubmitUploads}
        fileTypeLabel={fileTypeLabel}
      />

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
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
                <h3 className="text-xl font-semibold text-textDark dark:text-gray-200 flex items-center gap-3">
                  <AlertCircle size={24} />
                  Validation Report
                </h3>
                <button
                  onClick={() => setShowValidation(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 overflow-auto max-h-96">
                <pre className="text-sm text-textDark dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-4 rounded whitespace-pre-wrap">
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
            <p className="text-sm text-textDark/80 dark:text-gray-400">
              {deleteImpact ? (
                <>
                  This will remove{' '}
                  <span className="font-semibold">{deleteImpact.submit_claims.toLocaleString()}</span>{' '}
                  claim{deleteImpact.submit_claims === 1 ? '' : 's'} and{' '}
                  <span className="font-semibold">{deleteImpact.reimburse_rows.toLocaleString()}</span>{' '}
                  related reimburse entr{deleteImpact.reimburse_rows === 1 ? 'y' : 'ies'}. This action
                  cannot be undone.
                </>
              ) : (
                <>
                  All claims inserted by this file will also be permanently removed from the system,
                  including any related reimburse entries. This action cannot be undone.
                </>
              )}
            </p>
          </div>
        }
        confirmLabel={deletingId ? 'Deleting…' : 'Delete'}
        confirmIcon={
          deletingId ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />
        }
        onCancel={() => (!deletingId ? setConfirmDelete(null) : undefined)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete.id, confirmDelete.filename)}
        disabled={!!deletingId}
      />
    </div>
  );
};

export default UploadPage;
