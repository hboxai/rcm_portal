import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSubmitServerPreview, getSubmitUploadDownloadUrl } from '../services/uploadService';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';

const SubmitPreviewPage: React.FC = () => {
  const { uploadId = '' } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await getSubmitServerPreview(uploadId, 1000);
        if (cancelled) return;
        setFilename(res.original_filename || uploadId);
        setHeaders(res.columns || []);
        setRows(res.rows || []);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.response?.status === 410 ? 'File missing from S3' : (e?.message || 'Preview failed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uploadId]);

  const table = useMemo(() => ({ headers, rows }), [headers, rows]);

  const handleDownload = async () => {
    try {
      const url = await getSubmitUploadDownloadUrl(uploadId);
      const a = document.createElement('a'); a.href = url; a.download = filename || uploadId; a.rel='noopener'; a.click();
    } catch {
      setError('Download failed');
    }
  };

  return (
    <div className="container mx-auto px-6 pt-28 pb-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="px-3 py-1.5 rounded-md border hover:bg-gray-50 text-sm flex items-center gap-2"><ArrowLeft size={16}/> Back</button>
          <div>
            <div className="text-xl font-semibold text-textDark">Submit Preview</div>
            <div className="text-sm text-textDark/60 break-all">{filename}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownload} className="px-3 py-1.5 rounded-md border border-green-200 text-green-700 hover:bg-green-50 text-sm flex items-center gap-2"><Download size={16}/> Download</button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="py-16 text-center text-textDark/60"><Loader2 className="inline animate-spin mr-2"/> Loading preview…</div>
      ) : (
        <div className="rounded-lg border border-purple/20 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-purple/10">
                <tr>
                  {table.headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-medium text-textDark/80">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.length === 0 ? (
                  <tr><td className="px-3 py-6 text-center text-textDark/60" colSpan={table.headers.length}>No rows</td></tr>
                ) : table.rows.map((r, idx) => (
                  <tr key={idx} className={idx % 2 ? 'bg-white' : 'bg-white/60'}>
                    {table.headers.map((h, j) => (
                      <td key={j} className="px-3 py-1 align-top text-textDark/80">{String(r[h] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmitPreviewPage;
