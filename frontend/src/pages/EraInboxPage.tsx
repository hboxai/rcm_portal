import React, { useEffect, useState } from 'react';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';
import Toast from '../components/ui/Toast';
import { UploadCloud, Trash2, RefreshCw, Play, CheckSquare, Square } from 'lucide-react';
import { listEraPdfsGlobal, uploadEraPdfsGlobal, deleteEraPdfGlobal, getLatestParseBatch, ingestParsedRows, markRowsReviewed, commitParseBatch, autoParseEraPdf, EraParsedRow } from '../services/eraParseService';
import { useToast } from '../hooks/useToast';

export default function EraInboxPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [batch, setBatch] = useState<any | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());
  const [jsonInput, setJsonInput] = useState('');
  const { toasts, success, error, remove } = useToast();

  const sampleJson = `[
  {
    "submit_cpt_id": "SUB-10001-1",
    "prim_amt": 125.0,
    "prim_chk_det": "CHK#12345",
    "prim_recv_dt": "2025-11-10",
    "allowed_amt": 150.0,
    "write_off_amt": 25.0
  },
  {
    "patient_id": "PAT-42",
    "cpt_code": "99213",
    "dos": "2025-10-20",
    "sec_amt": 35.0,
    "sec_recv_dt": "2025-11-11",
    "claim_status": "IN_PROGRESS"
  }
]`;

  async function loadFiles() {
    setLoading(true);
    try { setFiles(await listEraPdfsGlobal(100)); } finally { setLoading(false); }
  }

  async function loadLatestBatch(fileId: string) {
    setBusy(true);
    try {
      const r = await getLatestParseBatch(Number(fileId), 1, 500);
      setBatch(r.batch);
      setRows(r.rows || []);
      setSelectedRowIds(new Set());
    } catch {
      setBatch(null); setRows([]);
    } finally { setBusy(false); }
  }

  useEffect(() => { loadFiles(); }, []);

  const onUpload = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    if (!ev.target.files || ev.target.files.length === 0) return;
    setBusy(true);
    try {
      const result = await uploadEraPdfsGlobal(Array.from(ev.target.files));
      await loadFiles();
      ev.target.value = '';
      success(`Successfully uploaded ${result.length} file(s)`);
    } catch (err: any) {
      error(`Upload failed: ${err?.response?.data?.message || err?.message || 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    setBusy(true);
    try {
      await deleteEraPdfGlobal(id);
      await loadFiles();
      if (selectedFileId === id) {
        setSelectedFileId(null);
        setBatch(null);
        setRows([]);
      }
      success('File deleted successfully');
    } catch (err: any) {
      error(`Delete failed: ${err?.response?.data?.message || err?.message || 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const onSelect = async (id: string) => {
    setSelectedFileId(id);
    setBusy(true);
    try {
      // First try to load existing batch
      await loadLatestBatch(id);
      
      // If no batch exists (rows is empty), trigger auto-parse
      const existingBatch = await getLatestParseBatch(Number(id), 1, 1);
      if (!existingBatch.batch || !existingBatch.rows || existingBatch.rows.length === 0) {
        success('Parsing PDF... This may take a moment.');
        const parseResult = await autoParseEraPdf(Number(id));
        success(`Auto-parsed ${parseResult.rowCount} claim row(s) from PDF`);
        await loadLatestBatch(id);
      }
    } catch (err: any) {
      error(`Failed to parse PDF: ${err?.response?.data?.message || err?.message || 'Unknown error'}`);
      // Still load whatever batch exists
      try { await loadLatestBatch(id); } catch { /* ignore - best effort */ }
    } finally {
      setBusy(false);
    }
  };

  const onIngest = async () => {
    try {
      const parsed = JSON.parse(jsonInput || '[]');
      if (!Array.isArray(parsed)) throw new Error('JSON must be an array of rows');
      setBusy(true);
      await ingestParsedRows(Number(selectedFileId), parsed as EraParsedRow[], 'json');
      await loadLatestBatch(String(selectedFileId));
      success(`Ingested ${parsed.length} row(s) successfully`);
      setJsonInput('');
    } catch (e: any) {
      error(e?.message || 'Failed to ingest parsed rows');
    } finally {
      setBusy(false);
    }
  };

  const onToggleRow = (rowId: number) => {
    const s = new Set(selectedRowIds);
    if (s.has(rowId)) s.delete(rowId); else s.add(rowId);
    setSelectedRowIds(s);
  };

  const onMarkReviewed = async (reviewed: boolean) => {
    if (!batch || selectedRowIds.size === 0) return;
    setBusy(true);
    try {
      await markRowsReviewed(batch.batch_id, Array.from(selectedRowIds), reviewed);
      await loadLatestBatch(String(selectedFileId));
      success(`Marked ${selectedRowIds.size} row(s) as ${reviewed ? 'reviewed' : 'unreviewed'}`);
    } catch (err: any) {
      error(`Failed to update rows: ${err?.message || 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const onCommit = async () => {
    if (!batch) return;
    setBusy(true);
    try {
      const res = await commitParseBatch(batch.batch_id, true);
      success(`Committed: matched=${res.stats.matched}, updated=${res.stats.updated}, notFound=${res.stats.notFound}`);
      await loadLatestBatch(String(selectedFileId));
    } catch (e: any) {
      error(e?.message || 'Commit failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-light-100 text-textDark pt-24">
      <div className="container mx-auto pb-12 px-4 md:px-6">
        <div className="mb-8 p-6 rounded-xl bg-white/95 backdrop-blur-sm border border-purple/20">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-textDark">ERA Inbox</h1>
            <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-md bg-purple text-white hover:bg-purple/90 border border-purple/30 shadow-sm ${busy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              <UploadCloud size={18} />
              <span>{busy ? 'Uploading...' : 'Upload ERA PDF'}</span>
              <input type="file" accept="application/pdf" multiple className="hidden" onChange={onUpload} disabled={busy} />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="bg-white/90 backdrop-blur-sm border border-purple/20 text-textDark">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-textDark">Uploaded PDFs</h3>
              <Button variant="secondary" className="text-purple hover:text-purple/80 border-purple/40 hover:border-purple/60 text-xs px-3 py-1" onClick={loadFiles} disabled={loading || busy} icon={<RefreshCw size={14}/>}>Refresh</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-textDark/70">
                    <th className="py-2">Filename</th>
                    <th className="py-2">Uploaded</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map(f => (
                    <tr key={f.id} className={`bg-white/80 hover:bg-white border border-purple/10 ${selectedFileId===f.id?'ring-2 ring-purple/40':''}`}>
                      <td className="py-2 px-3"><a href={f.url} target="_blank" rel="noreferrer" className="text-blue hover:underline">{f.original_filename}</a></td>
                      <td className="py-2 px-3 text-textDark">{new Date(f.uploaded_at).toLocaleString()}</td>
                      <td className="py-2 px-3 flex gap-2">
                        <Button className="bg-purple text-white hover:bg-purple/90 text-xs px-3 py-1 border border-purple/30" onClick={()=>onSelect(f.id)} disabled={busy}>Select</Button>
                        <Button variant="secondary" className="text-red hover:text-red/80 border-red/40 hover:border-red/60 text-xs px-3 py-1" onClick={()=>onDelete(f.id)} disabled={busy} icon={<Trash2 size={14}/>}>Delete</Button>
                      </td>
                    </tr>
                  ))}
                  {!files.length && (<tr><td className="py-6 text-textDark/60" colSpan={3}>No files yet.</td></tr>)}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <GlassCard className="bg-white/90 backdrop-blur-sm border border-purple/20 text-textDark">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-textDark">OCR Staging</h3>
              {selectedFileId && <Button variant="secondary" className="text-purple hover:text-purple/80 border-purple/40 hover:border-purple/60 text-xs px-3 py-1" onClick={()=>loadLatestBatch(selectedFileId)} disabled={busy} icon={<RefreshCw size={14}/>}>Refresh</Button>}
            </div>
            {!selectedFileId ? (
              <div className="text-textDark/60">Select a PDF to view or ingest parsed rows.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm text-textDark/70 mb-2 font-medium">Paste parsed rows (JSON array)</label>
                  <div className="mb-2 p-3 bg-blue/10 border border-blue/30 rounded-md text-xs text-textDark">
                    <p className="font-medium mb-1">📄 How to parse this PDF:</p>
                    <ol className="list-decimal list-inside space-y-1 text-textDark/80">
                      <li>Download the PDF by clicking the filename</li>
                      <li>Use an OCR tool or the Python script (<code className="bg-white/60 px-1 rounded">scripts/ingest_era_rows.py</code>)</li>
                      <li>Copy the parsed JSON array and paste it below</li>
                      <li>Click "Ingest" to load the data into the staging table</li>
                    </ol>
                    <p className="mt-2 text-xs">See <code className="bg-white/60 px-1 rounded">docs/ERA_OCR_PIPELINE.md</code> for details.</p>
                  </div>
                  <textarea value={jsonInput} onChange={(e)=>setJsonInput(e.target.value)} className="w-full min-h-[120px] glass-input bg-white/80 text-textDark border border-purple/30 focus:border-purple rounded-md p-2 font-mono text-xs" placeholder='[{"submit_cpt_id":"...","prim_amt":123.45,...}]'/>
                  <div className="mt-2 flex gap-2">
                    <Button className="bg-purple text-white hover:bg-purple/90 border border-purple/30 text-xs px-3 py-1" onClick={onIngest} disabled={busy || !jsonInput.trim()} icon={<Play size={14}/>}>Ingest</Button>
                    {jsonInput && (
                      <Button variant="secondary" className="text-textDark/60 hover:text-textDark border-textDark/20 hover:border-textDark/40 text-xs px-3 py-1" onClick={()=>setJsonInput('')} disabled={busy}>Clear</Button>
                    )}
                    {!jsonInput && (
                      <Button variant="secondary" className="text-blue hover:text-blue/80 border-blue/40 hover:border-blue/60 text-xs px-3 py-1" onClick={()=>setJsonInput(sampleJson)} disabled={busy}>Load Sample</Button>
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-textDark/70">Latest batch: {batch ? `#${batch.batch_id} (${batch.status})` : '—'}</div>
                    {batch && <Button className="bg-green text-white hover:bg-green/90 border border-green/30 text-xs px-3 py-1" onClick={onCommit} disabled={busy}>Commit Reviewed</Button>}
                  </div>
                  <div className="max-h-72 overflow-auto border border-purple/10 rounded">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left bg-white/70 text-textDark">
                          <th className="px-2 py-1">Sel</th>
                          <th className="px-2 py-1">Match</th>
                          <th className="px-2 py-1">prim_amt</th>
                          <th className="px-2 py-1">sec_amt</th>
                          <th className="px-2 py-1">pat_amt</th>
                          <th className="px-2 py-1">status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.row_id} className="odd:bg-white/70 even:bg-white/90 text-textDark">
                            <td className="px-2 py-1"><button className="text-purple hover:text-purple/80" onClick={()=>onToggleRow(r.row_id)}>{selectedRowIds.has(r.row_id) ? <CheckSquare size={16}/> : <Square size={16}/>}</button></td>
                            <td className="px-2 py-1">{r.submit_cpt_id || r.billing_id || `${r.patient_id||''}/${r.cpt_code||''}/${r.dos||''}`}</td>
                            <td className="px-2 py-1">{r.prim_amt ?? '—'}</td>
                            <td className="px-2 py-1">{r.sec_amt ?? '—'}</td>
                            <td className="px-2 py-1">{r.pat_amt ?? '—'}</td>
                            <td className="px-2 py-1">{r.claim_status ?? '—'} {r.reviewed ? '(reviewed)' : ''}</td>
                          </tr>
                        ))}
                        {!rows.length && (<tr><td className="px-2 py-4 text-textDark/60" colSpan={6}>No rows yet.</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                  {batch && (
                    <div className="mt-2 flex gap-2">
                      <Button variant="secondary" className="text-purple hover:text-purple/80 border-purple/40 hover:border-purple/60 text-xs px-3 py-1" onClick={()=>onMarkReviewed(true)} disabled={busy || selectedRowIds.size===0}>Mark Reviewed</Button>
                      <Button variant="secondary" className="text-textDark hover:text-textDark/80 border-textDark/20 hover:border-textDark/40 text-xs px-3 py-1" onClick={()=>onMarkReviewed(false)} disabled={busy || selectedRowIds.size===0}>Unreview</Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Toast Notifications */}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => remove(toast.id)}
        />
      ))}
    </div>
  );
}
