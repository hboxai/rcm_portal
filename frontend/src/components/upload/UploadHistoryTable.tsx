import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, AlertCircle, FileText, Eye, Download, Trash2, RefreshCw, PlayCircle } from 'lucide-react';
import type { SubmitUploadListItem } from '../../services/uploadService';

interface UploadHistoryTableProps {
  uploads: SubmitUploadListItem[];
  loading: boolean;
  error: string | null;
  isReimburse: boolean;
  isAdmin: boolean;
  onDownload: (uploadId: string, filename: string) => void;
  onDelete: (uploadId: string, filename: string) => void;
  onCommit?: (uploadId: string) => void;
  onRefresh?: () => void;
  fileTypeLabel?: string;
}

export const UploadHistoryTable: React.FC<UploadHistoryTableProps> = ({
  uploads,
  loading,
  error,
  isReimburse,
  isAdmin,
  onDownload,
  onDelete,
  onCommit,
  onRefresh,
  fileTypeLabel = isReimburse ? 'Reimburse' : 'Submit',
}) => {
  const navigate = useNavigate();

  const statusClasses = (status: string) => {
    switch (status) {
      case 'FAILED':
        return { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-600' };
      case 'COMMITTED':
        return { text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-600' };
      case 'COMPLETED':
        return { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-600' };
      case 'PROCESSING':
        return { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-600' };
      case 'ROLLED_BACK':
        return { text: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-600' };
      default:
        return { text: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-600' };
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="animate-spin text-primary" size={24} />
          <span className="text-textDark/60 dark:text-gray-400">Loading {fileTypeLabel.toLowerCase()} history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (uploads.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 border border-gray-200 dark:border-gray-700 text-center">
        <FileText className="mx-auto text-gray-400 mb-3" size={40} />
        <p className="text-textDark/60 dark:text-gray-400">
          No {fileTypeLabel.toLowerCase()} uploads yet. Upload a file to get started.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-white to-purple/5 dark:from-gray-800 dark:to-purple/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-purple/10 text-purple border border-purple/20">
            <FileText size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-textDark dark:text-gray-200">
              {fileTypeLabel} Upload History
            </h2>
            <p className="text-xs text-textDark/60 dark:text-gray-400">
              Recently uploaded {fileTypeLabel.toLowerCase()} files
            </p>
          </div>
          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple/10 text-purple border border-purple/20">
            {uploads.length} items
          </span>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-purple/30 text-purple hover:bg-purple/10 text-sm transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-textDark/60 dark:text-gray-400 uppercase tracking-wider">
                File
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-textDark/60 dark:text-gray-400 uppercase tracking-wider">
                Clinic
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-textDark/60 dark:text-gray-400 uppercase tracking-wider">
                Rows
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-textDark/60 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-textDark/60 dark:text-gray-400 uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-textDark/60 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {uploads.map((u) => {
              const s = statusClasses(u.status);
              return (
                <tr key={u.upload_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-textDark dark:text-gray-200 truncate max-w-[200px]">
                      {u.original_filename}
                    </div>
                    <div className="text-xs text-textDark/60 dark:text-gray-400">
                      {u.file_kind}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs border border-gray-200 dark:border-gray-600">
                      {u.clinic}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-textDark dark:text-gray-300">
                    {isReimburse ? (u as any).reimburse_count ?? '—' : u.row_count ?? '—'}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.bg} ${s.text} ${s.border}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-textDark/80 dark:text-gray-300 text-sm">
                    {new Date(u.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-2">
                      {isReimburse ? (
                        <ActionButton
                          icon={<Eye size={14} />}
                          label="View claims"
                          onClick={() => navigate(`/search?upload_id=${u.upload_id}`)}
                          variant="blue"
                        />
                      ) : (
                        <>
                          <ActionButton
                            icon={<Eye size={14} />}
                            label="Preview"
                            onClick={() => navigate(`/submit-preview/${u.upload_id}`)}
                            variant="blue"
                          />
                          {/* Show Commit button for PENDING/COMPLETED uploads that haven't been committed yet */}
                          {onCommit && (u.status === 'PENDING' || u.status === 'COMPLETED') && (
                            <ActionButton
                              icon={<PlayCircle size={14} />}
                              label="Commit"
                              onClick={() => onCommit(u.upload_id)}
                              variant="purple"
                            />
                          )}
                          <ActionButton
                            icon={<Download size={14} />}
                            label="Download"
                            onClick={() => onDownload(u.upload_id, u.original_filename)}
                            variant="green"
                          />
                          {isAdmin && (
                            <ActionButton
                              icon={<Trash2 size={14} />}
                              label="Delete"
                              onClick={() => onDelete(u.upload_id, u.original_filename)}
                              variant="red"
                            />
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant: 'blue' | 'green' | 'red' | 'purple';
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, label, onClick, variant }) => {
  const variants = {
    blue: 'border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/30',
    green: 'border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/30',
    red: 'border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30',
    purple: 'border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-900/30',
  };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition-colors ${variants[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
};

export default UploadHistoryTable;
