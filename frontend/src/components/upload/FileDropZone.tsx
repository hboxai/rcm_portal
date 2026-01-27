import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { UploadCloud, Download, Loader2 } from 'lucide-react';

interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
  uploadProgress: number;
  accept?: string;
  fileTypeLabel?: string;
  onDownloadTemplate?: () => void;
  disabled?: boolean;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onFilesSelected,
  isUploading,
  uploadProgress,
  accept = '.csv,.xlsx,.xls',
  fileTypeLabel = 'Submit',
  onDownloadTemplate,
  disabled = false,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
      <motion.div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200
          ${dragOver 
            ? 'border-primary bg-primary/5' 
            : 'border-gray-300 dark:border-gray-600 hover:border-primary/50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        whileHover={!disabled ? { scale: 1.01 } : {}}
        whileTap={!disabled ? { scale: 0.99 } : {}}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept={accept}
          onChange={handleFileChange}
          multiple
          disabled={disabled}
        />

        {isUploading ? (
          <div className="space-y-4">
            <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" />
            <div className="w-full max-w-xs mx-auto">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="bg-primary h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-sm text-textDark/60 dark:text-gray-400 mt-2">
                {uploadProgress < 100 ? `Processing... ${uploadProgress}%` : 'Completing...'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <UploadCloud className="mx-auto h-12 w-12 text-primary/60" />
            <div>
              <p className="text-lg font-medium text-textDark dark:text-gray-200">
                Drop your {fileTypeLabel} file here
              </p>
              <p className="text-sm text-textDark/60 dark:text-gray-400 mt-1">
                or click to browse
              </p>
            </div>
            <p className="text-xs text-textDark/50 dark:text-gray-500">
              Supported formats: CSV, XLSX, XLS
            </p>
          </div>
        )}
      </motion.div>

      {onDownloadTemplate && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownloadTemplate();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-primary hover:text-primary/80 hover:bg-primary/5 rounded-lg transition-colors"
          >
            <Download size={16} />
            Download template
          </button>
        </div>
      )}
    </div>
  );
};

export default FileDropZone;
