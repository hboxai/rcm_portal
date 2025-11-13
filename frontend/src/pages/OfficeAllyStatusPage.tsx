import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { uploadOfficeAllyStatus } from '../services/uploadService';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';

const OfficeAllyStatusPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(ext)) {
      setError('Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }
    
    setSelectedFile(file);
    setError(null);
    setUploadResult(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);
    
    try {
      const result = await uploadOfficeAllyStatus(selectedFile, (pct) => {
        setUploadProgress(pct);
      });
      
      setUploadProgress(100);
      
      if (result.success && result.data) {
        setUploadResult(result.data);
      } else {
        setError(result.error || 'Upload failed');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setError(null);
    setUploadProgress(0);
  };

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple/10 to-blue/10 pt-24">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/submit-files')}
            className="flex items-center gap-2 text-textDark hover:text-purple mb-4 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to Submit Files</span>
          </button>
          
          <h1 className="text-3xl font-bold text-textDark mb-2">
            Office Ally Status Update
          </h1>
          <p className="text-textDark/70">
            Upload the status file received from Office Ally to update claim statuses
          </p>
        </div>

        {/* Upload Area */}
        {!uploadResult && (
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-xl p-6 md:p-8 mb-6 border border-purple/20">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-purple bg-purple/5'
                  : 'border-gray-300 hover:border-purple/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <FileText className="mx-auto mb-4 text-purple" size={48} />
              
              {!selectedFile ? (
                <>
                  <p className="text-lg mb-2 text-textDark">
                    Drag and drop your Office Ally status file here
                  </p>
                  <p className="text-textDark/70 mb-4">or</p>
                  <label className="inline-block">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <span className="px-6 py-2 bg-purple hover:bg-purple/90 text-white rounded-lg cursor-pointer inline-flex items-center gap-2 transition-colors border border-purple/30 shadow-sm">
                      <Upload size={20} />
                      Choose File
                    </span>
                  </label>
                  <p className="text-sm text-textDark/70 mt-4">
                    Supported formats: .xlsx, .xls, .csv (Max 10MB)
                  </p>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="text-purple" size={24} />
                    <span className="text-textDark font-medium">{selectedFile.name}</span>
                  </div>
                  <p className="text-textDark/70 text-sm">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                  
                  {isUploading ? (
                    <div className="space-y-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-textDark/70 text-sm">
                        Uploading... {uploadProgress}%
                      </p>
                    </div>
                  ) : (
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={handleUpload}
                        className="px-6 py-2 bg-purple hover:bg-purple/90 text-white rounded-lg transition-colors border border-purple/30 shadow-sm"
                      >
                        Upload and Process
                      </button>
                      <button
                        onClick={handleReset}
                        className="px-6 py-2 bg-white hover:bg-gray-50 text-textDark rounded-lg transition-colors border border-gray-300 shadow-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-red-700 font-medium">Error</p>
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-textDark mb-2 flex items-center gap-2">
                <AlertCircle size={18} className="text-blue" />
                What happens during upload?
              </h3>
              <ul className="text-sm text-textDark/80 space-y-1 list-disc list-inside">
                <li>File is parsed and validated</li>
                <li>Claims are matched by Office Ally Claim ID</li>
                <li>Status, reference IDs, and dates are updated</li>
                <li>All changes are logged in the audit trail</li>
                <li>Summary report is generated</li>
              </ul>
            </div>
          </div>
        )}

        {/* Results */}
        {uploadResult && (
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-xl p-6 md:p-8 border border-purple/20">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="text-green" size={32} />
              <h2 className="text-2xl font-bold text-textDark">Upload Complete</h2>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-textDark/70 text-sm mb-1">Total Rows</p>
                <p className="text-2xl font-bold text-textDark">
                  {uploadResult.stats.total_rows}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-textDark/70 text-sm mb-1">Matched</p>
                <p className="text-2xl font-bold text-green-700">
                  {uploadResult.stats.matched}
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-textDark/70 text-sm mb-1">Updated</p>
                <p className="text-2xl font-bold text-blue-700">
                  {uploadResult.stats.updated}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <p className="text-textDark/70 text-sm mb-1">Not Found</p>
                <p className="text-2xl font-bold text-red-700">
                  {uploadResult.stats.not_found}
                </p>
              </div>
            </div>

            {/* Errors */}
            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                  <AlertCircle size={18} />
                  Warnings ({uploadResult.errors.length})
                </h3>
                <div className="max-h-60 overflow-y-auto">
                  <ul className="text-sm text-yellow-800 space-y-1">
                    {uploadResult.errors.slice(0, 20).map((err: string, idx: number) => (
                      <li key={idx} className="list-disc list-inside">
                        {err}
                      </li>
                    ))}
                    {uploadResult.errors.length > 20 && (
                      <li className="text-yellow-900 font-medium">
                        ... and {uploadResult.errors.length - 20} more
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* Processing time */}
            <p className="text-textDark/70 text-sm mb-6">
              Processing completed in {(uploadResult.duration_ms / 1000).toFixed(2)} seconds
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-purple hover:bg-purple/90 text-white rounded-lg transition-colors border border-purple/30 shadow-sm"
              >
                Upload Another File
              </button>
              <button
                onClick={() => navigate('/submit-files')}
                className="px-6 py-2 bg-white hover:bg-gray-50 text-textDark rounded-lg transition-colors border border-gray-300 shadow-sm"
              >
                View Submit Files
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OfficeAllyStatusPage;
