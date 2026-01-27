import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import type { QuickPreviewData, CommitSummary } from '../../hooks/useUpload';

interface UploadPreviewPanelProps {
  preview: QuickPreviewData;
  isSubmitting: boolean;
  progress: number;
  commitDone: boolean;
  commitSummary: CommitSummary | null;
  commitWarnings: string[];
  error: string | null;
  isReimburse: boolean;
  onCommit: () => void;
  onCancel: () => void;
  onUploadAnother: () => void;
}

export const UploadPreviewPanel: React.FC<UploadPreviewPanelProps> = ({
  preview,
  isSubmitting,
  progress,
  commitDone,
  commitSummary,
  commitWarnings,
  error,
  isReimburse,
  onCommit,
  onCancel,
  onUploadAnother,
}) => {
  const fileTypeLabel = isReimburse ? 'Reimburse' : 'Submit';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-xl shadow-md p-6 border border-gray-200 dark:bg-gray-800 dark:border-gray-700"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {commitDone ? (
            <CheckCircle className="text-green-500" size={24} />
          ) : preview.can_commit ? (
            <CheckCircle className="text-blue-500" size={24} />
          ) : (
            <AlertCircle className="text-amber-500" size={24} />
          )}
          <div>
            <h3 className="text-lg font-semibold text-textDark dark:text-gray-200">
              {commitDone ? 'Upload Complete' : 'Preview'}
            </h3>
            <p className="text-sm text-textDark/60 dark:text-gray-400">
              {preview.original_filename || 'Uploaded file'}
            </p>
          </div>
        </div>
        {!isSubmitting && !commitDone && (
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-textDark/60 dark:text-gray-400" />
          </button>
        )}
      </div>

      {/* Progress bar during commit */}
      {isSubmitting && !commitDone && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-textDark/60 dark:text-gray-400">
              Processing...
            </span>
            <span className="text-sm font-medium text-primary">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <motion.div
              className="bg-primary h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Rows"
          value={preview.row_count}
          color="blue"
        />
        {preview.validation_summary && (
          <>
            <StatCard
              label="Valid Rows"
              value={preview.validation_summary.valid_rows}
              color="green"
            />
            <StatCard
              label="Rows with Errors"
              value={preview.validation_summary.rows_with_errors}
              color={preview.validation_summary.rows_with_errors > 0 ? 'red' : 'gray'}
            />
          </>
        )}
        {commitDone && commitSummary && (
          <>
            <StatCard
              label="Inserted"
              value={commitSummary.inserted}
              color="green"
            />
            <StatCard
              label="Updated"
              value={commitSummary.updated}
              color="blue"
            />
            <StatCard
              label="Skipped"
              value={commitSummary.skipped}
              color="gray"
            />
          </>
        )}
      </div>

      {/* Duplicate warning */}
      {preview.duplicate_of && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-amber-500 mt-0.5" size={18} />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Duplicate File Detected
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                This file appears to be a duplicate of a previously uploaded file.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Errors */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-red-500 mt-0.5" size={18} />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Validation Errors
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1 whitespace-pre-wrap">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {commitWarnings.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-amber-500 mt-0.5" size={18} />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Warnings
              </p>
              <ul className="text-xs text-amber-700 dark:text-amber-300 mt-1 list-disc list-inside">
                {commitWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Note */}
      {preview.note && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">{preview.note}</p>
        </div>
      )}

      {/* Sample rows preview */}
      {preview.sample_rows && preview.sample_rows.length > 0 && !commitDone && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-textDark dark:text-gray-200 mb-2">
            Sample Data
          </h4>
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  {Object.keys(preview.sample_rows[0] || {}).slice(0, 6).map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left font-medium text-textDark/70 dark:text-gray-400"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {preview.sample_rows.slice(0, 3).map((row, i) => (
                  <tr key={i} className="bg-white dark:bg-gray-800">
                    {Object.values(row).slice(0, 6).map((val, j) => (
                      <td
                        key={j}
                        className="px-3 py-2 text-textDark/80 dark:text-gray-300 truncate max-w-[150px]"
                      >
                        {String(val ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        {commitDone ? (
          <button
            onClick={onUploadAnother}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Upload Another File
          </button>
        ) : (
          <>
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-textDark dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onCommit}
              disabled={!preview.can_commit || isSubmitting}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Processing...
                </>
              ) : (
                `Commit ${fileTypeLabel}`
              )}
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
};

interface StatCardProps {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'red' | 'gray' | 'amber';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
    gray: 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
  };

  return (
    <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="text-lg font-semibold">{value.toLocaleString()}</p>
    </div>
  );
};

export default UploadPreviewPanel;
