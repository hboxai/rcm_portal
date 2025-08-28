import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, Loader2, Download, Trash2, FileText, Calendar, Hash, AlertCircle, CheckCircle, X } from 'lucide-react';
import { downloadUpload, listUploads, uploadMetabaseExport, deleteUpload, getUploadValidationReport } from '../services/uploadService';
import { UploadedFile } from '../types/file';
import { trackEvent } from '../utils/audit';

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

  useEffect(() => {
    refreshUploads();
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
    setProgress(0);

    try {
      for (const file of validFiles) {
        trackEvent('upload:start', { name: file.name, size: file.size });
        const result = await uploadMetabaseExport(file, setProgress);
        
        if (!result.success) {
          setError(result.message || 'Upload failed');
          break;
        }
        
        trackEvent('upload:success', { id: result.file?.id, name: file.name });
        setSuccess(`Successfully uploaded ${file.name}`);
        
        // Refresh the uploads list
        await refreshUploads();
      }
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDelete = async (fileId: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;
    
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
            multiple
            accept=".csv,.xlsx,.xls"
            onChange={(e) => e.target.files && handleUpload(Array.from(e.target.files))}
            className="hidden"
          />
          
          {uploading ? (
            <div className="space-y-4">
              <Loader2 className="mx-auto animate-spin text-purple" size={64} />
              <div className="space-y-3">
                <p className="text-xl text-textDark">Uploading file...</p>
                <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-purple h-3 rounded-full transition-all duration-300"
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
                  Drop your Excel files here or{' '}
                  <button 
                    onClick={handleFileSelect}
                    className="text-purple hover:text-purple/80 underline font-medium"
                  >
                    browse
                  </button>
                </p>
                <p className="text-base text-textDark/60">
                  Supports .csv, .xlsx, and .xls files
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Files List */}
      <div className="rounded-lg border border-purple/20 bg-white shadow-sm">
        <div className="p-6 border-b border-purple/20">
          <h2 className="text-xl font-semibold text-textDark flex items-center gap-2">
            <FileText size={24} />
            Uploaded Files ({files.length})
          </h2>
        </div>

        <div className="divide-y divide-purple/10">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="mx-auto animate-spin text-purple mb-3" size={32} />
              <p className="text-textDark/60 text-lg">Loading files...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="p-12 text-center text-textDark/60 text-lg">
              No files uploaded yet
            </div>
          ) : (
            files.map((file) => (
              <div key={file.id} className="p-6 hover:bg-purple/5 transition-colors">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-4 mb-3">
                      <FileText className="text-purple flex-shrink-0" size={24} />
                      <h3 className="font-semibold text-textDark text-lg">{file.filename}</h3>
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium border ${getStatusColor(file.status)}`}>
                        {getStatusIcon(file.status)}
                        {file.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-8 text-textDark/60">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        <span>{formatDate(file.uploadedAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Hash size={16} />
                        <span>{file.claimsCount} claims processed</span>
                      </div>
                      <div className="text-sm font-mono bg-gray-100 px-3 py-1 rounded">
                        ID: {file.id}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => handlePreview(file)}
                      className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors border border-blue-200"
                      title="Preview file"
                    >
                      <FileText size={16} />
                      Preview
                    </button>
                    <button
                      onClick={() => handleDownload(file.id, file.filename)}
                      className="flex items-center gap-2 px-4 py-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md transition-colors border border-green-200"
                      title="Download file"
                    >
                      <Download size={16} />
                      Download
                    </button>
                    <button
                      onClick={() => handleValidation(file.id)}
                      className="flex items-center gap-2 px-4 py-2 text-purple hover:text-purple/80 hover:bg-purple/10 rounded-md transition-colors border border-purple/20"
                      title="View validation report"
                    >
                      <AlertCircle size={16} />
                      Validate
                    </button>
                    <button
                      onClick={() => handleDelete(file.id, file.filename)}
                      className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors border border-red-200"
                      title="Delete file"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

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
    </div>
  );
};

export default UploadPage;
