import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, Eye, Loader2, AlertCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { getUploadPreview, downloadUpload } from '../services/uploadService';
import { trackEvent } from '../utils/audit';

interface PreviewData {
  headers: string[];
  rows: any[];
  totalRows: number;
  totalPreviewRows: number;
  filename: string;
}

const PreviewPage: React.FC = () => {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(50);

  useEffect(() => {
    if (!fileId) {
      navigate('/upload');
      return;
    }
    loadPreview();
  }, [fileId, navigate]);

  const loadPreview = async () => {
    if (!fileId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getUploadPreview(fileId, 1000); // Load up to 1000 rows for full view
      setPreviewData(data);
      trackEvent('upload:preview:fullview', { id: fileId });
    } catch (e: any) {
      setError('Failed to load preview: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!fileId || !previewData) return;
    
    try {
      trackEvent('upload:download', { id: fileId });
      const blob = await downloadUpload(fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = previewData.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError('Failed to download file');
    }
  };

  // Filter rows based on search term
  const filteredRows = React.useMemo(() => {
    if (!previewData || !searchTerm.trim()) return previewData?.rows || [];
    
    return previewData.rows.filter(row =>
      previewData.headers.some(header =>
        String(row[header] || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [previewData, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const startIdx = (currentPage - 1) * rowsPerPage;
  const endIdx = startIdx + rowsPerPage;
  const currentRows = filteredRows.slice(startIdx, endIdx);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-28 pb-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-purple mb-4" size={48} />
            <h2 className="text-2xl font-semibold text-textDark mb-2">Loading Preview</h2>
            <p className="text-textDark/60">Please wait while we load the file data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 pt-28 pb-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col items-center justify-center py-20">
            <AlertCircle className="text-red-500 mb-4" size={48} />
            <h2 className="text-2xl font-semibold text-textDark mb-2">Preview Failed</h2>
            <p className="text-textDark/60 mb-6">{error}</p>
            <button
              onClick={() => navigate('/upload')}
              className="flex items-center gap-2 px-6 py-3 bg-purple text-white rounded-md hover:bg-purple/90 transition-colors"
            >
              <ArrowLeft size={20} />
              Back to Upload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!previewData) return null;

  return (
    <div className="min-h-screen bg-gray-50 pt-28 pb-12">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/upload')}
              className="flex items-center gap-2 px-4 py-2 text-textDark hover:text-purple transition-colors"
            >
              <ArrowLeft size={20} />
              Back to Upload Page
            </button>
            <div className="h-6 w-px bg-gray-300" />
            <div>
              <h1 className="text-3xl font-semibold text-textDark flex items-center gap-3">
                <Eye size={32} />
                File Preview
              </h1>
              <p className="text-textDark/60 mt-1">{previewData.filename}</p>
            </div>
          </div>
          
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <Download size={20} />
            Download File
          </button>
        </div>

        {/* Stats and Search */}
        <div className="bg-white rounded-lg shadow-sm border border-purple/20 mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple">{previewData.headers.length}</div>
                  <div className="text-sm text-textDark/60">Columns</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple">{previewData.totalRows}</div>
                  <div className="text-sm text-textDark/60">Total Rows</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple">{filteredRows.length}</div>
                  <div className="text-sm text-textDark/60">Filtered Rows</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-textDark/40" size={16} />
                  <input
                    type="text"
                    placeholder="Search in all columns..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1); // Reset to first page when searching
                    }}
                    className="pl-10 pr-4 py-2 w-80 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple/20 focus:border-purple"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-sm border border-purple/20 overflow-hidden">
          {filteredRows.length === 0 ? (
            <div className="p-12 text-center">
              <Search className="mx-auto text-textDark/40 mb-4" size={48} />
              <h3 className="text-xl font-semibold text-textDark mb-2">No results found</h3>
              <p className="text-textDark/60">No rows match your search criteria. Try a different search term.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-purple/5 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-textDark border-b border-purple/10 bg-purple/5">
                        Row #
                      </th>
                      {previewData.headers.map((header, idx) => (
                        <th
                          key={idx}
                          className="px-4 py-3 text-left text-sm font-semibold text-textDark border-b border-purple/10 bg-purple/5 min-w-32"
                        >
                          <div className="truncate" title={header}>
                            {header}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentRows.map((row, rowIdx) => {
                      const actualRowNumber = startIdx + rowIdx + 1;
                      return (
                        <tr key={rowIdx} className="hover:bg-purple/5 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-purple sticky left-0 bg-white border-r border-gray-200">
                            {actualRowNumber}
                          </td>
                          {previewData.headers.map((header, colIdx) => (
                            <td key={colIdx} className="px-4 py-3 text-sm text-textDark">
                              <div className="max-w-48 truncate" title={String(row[header] || '')}>
                                {String(row[header] || '')}
                              </div>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-purple/10 bg-purple/5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-textDark/60">
                      Showing {startIdx + 1} to {Math.min(endIdx, filteredRows.length)} of {filteredRows.length} rows
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="flex items-center gap-1 px-3 py-2 text-sm text-textDark border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </button>
                      
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`px-3 py-2 text-sm rounded-md transition-colors ${
                                currentPage === pageNum
                                  ? 'bg-purple text-white'
                                  : 'text-textDark hover:bg-gray-100 border border-gray-300'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-1 px-3 py-2 text-sm text-textDark border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreviewPage;
