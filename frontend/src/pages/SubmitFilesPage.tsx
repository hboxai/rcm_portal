import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, UploadCloud, Loader2, ChevronDown, ChevronRight, Download, Trash2, CheckSquare, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { downloadUpload, getClaimsByUpload, listUploads, uploadMetabaseExport, deleteUpload, getUploadValidationReport, getAllClaims } from '../services/uploadService';
import { UploadedFile } from '../types/file';
import { VisitClaim } from '../types/claim';
import { trackEvent } from '../utils/audit';

type RowState = { [claimId: string]: boolean };

const statusColor = (status?: string) => {
  const s = (status || '').toLowerCase();
  if (s.includes('paid')) return 'bg-green-500';
  if (s.includes('pend')) return 'bg-yellow-500';
  if (s.includes('deny') || s.includes('fail')) return 'bg-red-500';
  return 'bg-gray-400';
};

const SubmitFilesPage: React.FC = () => {
  const navigate = useNavigate();
  
  // Upload dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Uploaded files list
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [fileFilter, setFileFilter] = useState('');
  const [fileSort, setFileSort] = useState<{ key: 'uploadedAt' | 'claimsCount' | 'status'; dir: 'asc' | 'desc' }>({ key: 'uploadedAt', dir: 'desc' });
  const [selectedFileIds, setSelectedFileIds] = useState<Record<string, boolean>>({});
  const [showValidationFor, setShowValidationFor] = useState<string | null>(null);
  const [validationLines, setValidationLines] = useState<string[]>([]);

  // Selected file and claims
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [claims, setClaims] = useState<VisitClaim[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [limit] = useState(20);
  const [page, setPage] = useState(1);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [rowOpen, setRowOpen] = useState<RowState>({});

  // Claim filters
  const [claimIdFilter, setClaimIdFilter] = useState('');
  const [patientFilter, setPatientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fileIdFilter, setFileIdFilter] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch uploads list
  const refreshUploads = useCallback(async () => {
    const data = await listUploads(fileFilter ? { fileId: fileFilter } : {});
    const sorted = [...data].sort((a, b) => {
      const dir = fileSort.dir === 'asc' ? 1 : -1;
      if (fileSort.key === 'uploadedAt') return (new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()) * dir;
      if (fileSort.key === 'claimsCount') return (a.claimsCount - b.claimsCount) * dir;
      return a.status.localeCompare(b.status) * dir;
    });
    setFiles(sorted);
  }, [fileFilter, fileSort]);

  useEffect(() => {
    refreshUploads();
  }, [refreshUploads]);

  // When File ID filter matches an upload, select it
  useEffect(() => {
    if (!fileIdFilter) return;
    const match = files.find(f => f.id === fileIdFilter);
    if (match) {
      setSelectedFileId(match.id);
      setPage(1);
    }
  }, [fileIdFilter, files]);

  // Fetch claims when file or filters/page changes
  const loadClaims = useCallback(async () => {
    setLoadingClaims(true);
    try {
  if (selectedFileId) {
        const res = await getClaimsByUpload(selectedFileId, {
          page,
          limit,
          claimId: claimIdFilter || undefined,
          patientName: patientFilter || undefined,
          status: statusFilter || undefined,
        });
        setClaims(res.data || []);
        setTotalCount(res.totalCount || 0);
      } else {
        const allowedStatuses = ['Pending','Paid','Denied','Appealed',''] as const;
        const statusParam = (allowedStatuses as readonly string[]).includes(statusFilter) ? (statusFilter as any) : undefined;
  const res = await getAllClaims({
          page,
          limit,
          // Map filters; backend supports: billingId, dos, prim_ins (payer), status, patient_id, cpt_code
          billingId: claimIdFilter || undefined,
          status: statusParam,
          patientId: patientFilter || undefined,
        });
        // Map backend rows to VisitClaim minimal fields used by table
        const rows: VisitClaim[] = (res.data || []).map((r: any) => ({
          // Required fields per VisitClaim
          claimId: String(r.oa_claim_id || r.claim_id || r.id || ''),
          memberId: String(r.patient_id || r.patient_emr_no || ''),
          patientName: r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : String(r.patient_emr_no || r.patient_id || ''),
          payer: String(r.prim_ins || ''),
          billedAmount: Number(r.total_amt ?? r.charge_amt ?? 0),
          status: String(r.claim_status || r.claim_status_type || ''),
          // Optional fields used in UI
          dateOfBirth: r.date_of_birth || undefined,
          prim_ins: r.prim_ins || undefined,
          total_amt: r.total_amt ?? r.charge_amt ?? undefined,
          oa_claim_id: r.oa_claim_id || undefined,
        }));
        setClaims(rows);
        setTotalCount(res.totalCount || 0);
      }
    } finally {
      setLoadingClaims(false);
    }
  }, [selectedFileId, page, limit, claimIdFilter, patientFilter, statusFilter]);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  const onDropFiles = async (dropped: FileList | File[]) => {
    const list = Array.from(dropped);
  const valid = list.filter(f => /\.(csv|xlsx|xls)$/i.test(f.name));
    if (valid.length === 0) {
  setError('Only .csv, .xlsx and .xls files are accepted.');
      return;
    }
    setError(null);
    setUploading(true);
    setProgress(0);
    try {
      for (const f of valid) {
        trackEvent('upload:start', { name: f.name, size: f.size });
        const result = await uploadMetabaseExport(f, setProgress);
        if (!result.success) {
          setError(result.message || 'Upload failed');
          break;
        }
        trackEvent('upload:success', { id: result.file?.id, name: f.name });
        // Poll uploads list for a few seconds to reflect status/claims
        const started = Date.now();
        while (Date.now() - started < 8000) {
          await refreshUploads();
          await new Promise(r => setTimeout(r, 800));
          const fnd = (await (async ()=>{ return (await listUploads({})); })()).find(u => u.id === result.file?.id);
          if (fnd && (fnd.status !== 'Processing' || (fnd.claimsCount ?? 0) > 0)) break;
        }
      }
      await refreshUploads();
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / limit)), [totalCount, limit]);

  const onDownload = async (fileId: string, filename: string) => {
    try {
      trackEvent('upload:download', { id: fileId });
      const blob = await downloadUpload(fileId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError('Failed to download file');
    }
  };

  const onBulkDownload = async () => {
    const ids = Object.entries(selectedFileIds).filter(([, v]) => v).map(([k]) => k);
    for (const id of ids) {
      const f = files.find(ff => ff.id === id);
      if (f) await onDownload(id, f.filename);
    }
  };

  const onBulkDelete = async () => {
    const ids = Object.entries(selectedFileIds).filter(([, v]) => v).map(([k]) => k);
    for (const id of ids) {
      const res = await deleteUpload(id);
      if (!res.success) setError(res.message || 'Delete failed');
      else trackEvent('upload:delete', { id });
    }
    setSelectedFileIds({});
    await refreshUploads();
  };

  const toggleSelectAll = (checked: boolean) => {
    const map: Record<string, boolean> = {};
    for (const f of files) map[f.id] = checked;
    setSelectedFileIds(map);
  };

  const onViewValidation = async (id: string) => {
    setShowValidationFor(id);
    const lines = await getUploadValidationReport(id);
    setValidationLines(lines);
    trackEvent('upload:validation:view', { id });
  };

  const exportClaimsCsv = () => {
    const headers = ['FirstName','LastName','FacilityName','PayorStatus','OAClaimID','PayorRefID'];
    const rows = claims.map(c => {
      const firstName = (c as any).patientfirst || (c as any).patient_first || '';
      const lastName = (c as any).patientlast || (c as any).patient_last || '';
      const facilityName = (c as any).facilityname || (c as any).facility_name || (c as any).renderingprovidername || '';
      const payorStatus = (c as any).payor_status || '';
      const oaClaimId = (c as any).oa_claim_id || (c as any).oaclaimid || '';
      const payorRefId = (c as any).payor_reference_id || (c as any).prim_chk_det || '';
      
      return [
        firstName,
        lastName,
        facilityName,
        payorStatus,
        oaClaimId,
        payorRefId,
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `claims_${selectedFileId || 'export'}.csv`; a.click();
    URL.revokeObjectURL(url);
    trackEvent('claims:export', { fileId: selectedFileId, count: claims.length });
  };

  return (
    <div className="container mx-auto px-4 pt-28 pb-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-semibold text-textDark">Submit Files</h1>
        <button
          className="inline-flex items-center gap-2 self-start md:self-auto px-4 py-2 rounded-md bg-purple text-white hover:bg-purple/90 border border-purple/30 shadow-sm"
          onClick={() => navigate('/upload')}
        >
          <UploadCloud size={18} /> Upload New File
        </button>
      </div>

      {/* Claims filters - Removed filter inputs */}
      <div className="rounded-lg border border-purple/20 bg-white/80 backdrop-blur p-4 mb-4">
        <div className="flex items-end justify-between gap-2">
          <div className="text-sm text-textDark/60 flex items-center gap-2">
            {selectedFileId ? (
              <>
                <span>Showing claims for File ID {selectedFileId}</span>
                <button className="text-xs px-2 py-1 rounded border" onClick={()=>{ setSelectedFileId(null); setPage(1); }}>Clear</button>
              </>
            ) : (
              <span>Showing all claims</span>
            )}
          </div>
          <button onClick={exportClaimsCsv} disabled={!claims.length} className="px-3 py-2 rounded-md border border-textDark/20 disabled:opacity-50">Export CSV</button>
        </div>
      </div>

      {/* Claims table */}
      <div className="rounded-lg border border-purple/20 bg-white/80 backdrop-blur">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm whitespace-nowrap">
      <thead className="bg-purple/10">
              <tr className="text-left">
                <th className="px-4 py-2"> </th>
                <th className="px-4 py-2">First Name</th>
                <th className="px-4 py-2">Last Name</th>
                <th className="px-4 py-2">Facility Name</th>
                <th className="px-4 py-2">Payor Status</th>
                <th className="px-4 py-2">OA Claim ID</th>
                <th className="px-4 py-2">Payor Ref ID</th>
              </tr>
            </thead>
            <tbody>
              {loadingClaims ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-textDark/60"><Loader2 className="inline animate-spin mr-2"/> Loading claims…</td></tr>
              ) : (fileIdFilter && selectedFileId && !String(selectedFileId).includes(fileIdFilter)) ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-textDark/60">No claims match this File ID filter</td></tr>
              ) : claims.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="text-textDark/70">No claims found.</div>
                    <div className="text-xs text-textDark/50">Try adjusting filters or upload a file to create claims.</div>
                  </td>
                </tr>
              ) : (
                claims.map((c) => {
                  const open = !!rowOpen[c.claimId || c.id || ''];
                  const key = c.claimId || c.id || Math.random().toString();
                  const firstName = (c as any).patientfirst || (c as any).patient_first || '';
                  const lastName = (c as any).patientlast || (c as any).patient_last || '';
                  const facilityName = (c as any).facilityname || (c as any).facility_name || (c as any).renderingprovidername || '';
                  const payorStatus = (c as any).payor_status || '';
                  const oaClaimId = (c as any).oa_claim_id || (c as any).oaclaimid || '';
                  const payorRefId = (c as any).payor_reference_id || (c as any).prim_chk_det || '';
                  return (
                    <React.Fragment key={key}>
                      <tr className="border-t border-textDark/10">
                        <td className="px-4 py-2 align-top">
                          <button
                            className="p-1 rounded hover:bg-purple/10"
                            onClick={() => setRowOpen(prev => ({ ...prev, [key]: !open }))}
                          >
                            {open ? <ChevronDown size={18}/> : <ChevronRight size={18}/>} 
                          </button>
                        </td>
                        <td className="px-4 py-2 align-top">{firstName || '—'}</td>
                        <td className="px-4 py-2 align-top">{lastName || '—'}</td>
                        <td className="px-4 py-2 align-top">{facilityName || '—'}</td>
                        <td className="px-4 py-2 align-top">{payorStatus || '—'}</td>
                        <td className="px-4 py-2 align-top">{oaClaimId || '—'}</td>
                        <td className="px-4 py-2 align-top">{payorRefId || '—'}</td>
                      </tr>
                      <tr className={`${open ? '' : 'hidden'}`}>
                        <td colSpan={7} className="px-4 pb-4">
                          <div className="mt-2 rounded-md border border-textDark/10 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Claim Header */}
                            <section>
                              <h3 className="font-semibold text-textDark mb-2">Claim Header</h3>
                              <div className="text-sm text-textDark/80 space-y-1">
                                <div>File ID: {selectedFileId || '—'}</div>
                                <div>Claim ID: {c.oa_claim_id || c.claimId || '—'}</div>
                                <div>DOS: {(c as any).charge_dt || (c as any).service_start || (c as any).service_end || (c as any).dos || '—'}</div>
                                <div>Status: {c.status || c.claim_status || '—'}</div>
                                <div>Payer Ref: {(c as any).prim_chk_det || '—'}</div>
                                <div>Denial Code: {(c as any).sec_denial_code || '—'}</div>
                              </div>
                            </section>
                            {/* Patient Information */}
                            <section>
                              <h3 className="font-semibold text-textDark mb-2">Patient</h3>
                              <div className="text-sm text-textDark/80 space-y-1">
                                <div>ID: {(c as any).patientId || (c as any).patient_id || '—'}</div>
                                <div>Name: {c.patientName || '—'}</div>
                                <div>DOB: {c.dateOfBirth || '—'}</div>
                                <div>Visit/EMR: {(c as any).oa_visit_id || (c as any).patient_emr_no || '—'}</div>
                              </div>
                            </section>
                            {/* Insurance/Payer */}
                            <section>
                              <h3 className="font-semibold text-textDark mb-2">Payer</h3>
                              <div className="text-sm text-textDark/80 space-y-1">
                                <div>Primary: {c.prim_ins || '—'}</div>
                                <div>Primary Amt: {(c as any).prim_amt ?? '—'}</div>
                                <div>Primary Posted: {(c as any).prim_post_dt || '—'}</div>
                                <div>Secondary: {(c as any).sec_ins || '—'}</div>
                                <div>Secondary Amt: {(c as any).sec_amt ?? '—'}</div>
                              </div>
                            </section>
                            {/* Service Lines */}
                            <section>
                              <h3 className="font-semibold text-textDark mb-2">Service</h3>
                              <div className="text-sm text-textDark/80 space-y-1">
                                <div>CPT(s): {((c as any).cpt_code || (c.cptCodes || []).filter(Boolean).join(', ') || (c as any).billing_id || '—')}</div>
                                <div>Units: {(c as any).units ?? '—'}</div>
                              </div>
                            </section>
                            {/* Financials */}
                            <section className="md:col-span-2">
                              <h3 className="font-semibold text-textDark mb-2">Financials</h3>
                              <div className="text-sm text-textDark/80 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                                <div>Total Charges: {(c as any).total_amt ?? (c as any).charge_amt ?? c.billedAmount ?? '—'}</div>
                                <div>Allowed: {(c as any).allowed_amt ?? '—'}</div>
                                <div>Allowed+Add: {(c as any).allowed_add_amt ?? '—'}</div>
                                <div>Allowed Exp: {(c as any).allowed_exp_amt ?? '—'}</div>
                                <div>Adj: {(c as any).charges_adj_amt ?? '—'}</div>
                                <div>Write-off: {(c as any).write_off_amt ?? '—'}</div>
                                <div>Paid (Primary): {(c as any).prim_chk_amt ?? '—'}</div>
                                <div>Paid (Secondary): {(c as any).sec_chk_amt ?? '—'}</div>
                                <div>Balance: {(c as any).bal_amt ?? '—'}</div>
                                <div>Reimb%: {(c as any).reimb_pct ?? '—'}</div>
                              </div>
                            </section>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 text-sm text-textDark/70">
          <div>Page {page} of {totalPages} • {totalCount} total</div>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p-1))} className="px-3 py-1 rounded border border-textDark/20 disabled:opacity-50">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p+1))} className="px-3 py-1 rounded border border-textDark/20 disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      {/* Upload dialog (simplified) */}
      <AnimatePresence>
        {dialogOpen && (
          <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => setDialogOpen(false)} />
            <motion.div
              className="relative z-[61] w-full max-w-xl rounded-md border bg-white p-0 shadow-lg"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h2 className="text-base font-semibold text-textDark">Upload File</h2>
                <button onClick={() => setDialogOpen(false)} className="p-1 rounded hover:bg-gray-100">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                {/* Upload area */}
                <div
                  className={`rounded border-2 border-dashed ${dragOver ? 'border-gray-500 bg-gray-50' : 'border-gray-300'} p-5 text-center`}
                  onDragOver={(e)=>{e.preventDefault(); setDragOver(true);}}
                  onDragLeave={()=>setDragOver(false)}
                  onDrop={(e)=>{e.preventDefault(); setDragOver(false); onDropFiles(e.dataTransfer.files);}}
                >
                  <UploadCloud className="mx-auto text-gray-600 mb-2" />
                  <p className="text-sm text-textDark mb-2">Click Browse or drag & drop a .csv, .xlsx, or .xls file.</p>
                  <div className="flex items-center justify-center">
                    <button
                      className="px-3 py-2 rounded bg-gray-900 text-white hover:bg-gray-800"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      Browse…
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      multiple
                      className="hidden"
                      onChange={(e)=> e.target.files && onDropFiles(e.target.files)}
                    />
                  </div>
                  {uploading && (
                    <div className="mt-3 text-left">
                      <div className="h-2 w-full rounded bg-gray-100 overflow-hidden">
                        <div className="h-2 bg-gray-800" style={{ width: `${progress}%`}} />
                      </div>
                      <div className="mt-1 text-xs text-textDark/70">Uploading… {progress}%</div>
                    </div>
                  )}
                  {error && (
                    <div className="mt-3 text-sm text-red-600">{error}</div>
                  )}
                </div>

                {/* Recent uploads (simple list) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-textDark">Recent uploads</h3>
                    <button onClick={refreshUploads} className="text-xs px-2 py-1 rounded border">Refresh</button>
                  </div>
                  {files.length === 0 ? (
                    <div className="text-sm text-textDark/60 py-6 text-center">No uploads yet</div>
                  ) : (
                    <ul className="divide-y max-h-64 overflow-auto">
                      {files.slice(0, 5).map(f => (
                        <li key={f.id} className="py-2 px-1 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm truncate">{f.filename}</div>
                            <div className="text-xs text-textDark/60">{new Date(f.uploadedAt).toLocaleString()} • {f.claimsCount} claims • {f.status}</div>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <button className="text-xs px-2 py-1 rounded border" onClick={() => onDownload(f.id, f.filename)}>Download</button>
                            <button className="text-xs px-2 py-1 rounded border" onClick={() => { setSelectedFileId(f.id); setDialogOpen(false); setPage(1); trackEvent('upload:view-in-app', { id: f.id }); }}>View</button>
                            <button className="text-xs px-2 py-1 rounded border" onClick={() => onViewValidation(f.id)}>Validate</button>
                            <button className="text-xs px-2 py-1 rounded border border-red-300 text-red-700" onClick={async ()=>{ const res = await deleteUpload(f.id); if (!res.success) setError(res.message || 'Delete failed'); else { trackEvent('upload:delete', { id: f.id }); refreshUploads(); }}}>Delete</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="px-4 py-3 border-t flex justify-end">
                <button className="px-3 py-2 rounded border" onClick={()=>setDialogOpen(false)}>Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Validation report modal */}
      <AnimatePresence>
        {showValidationFor && (
          <motion.div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowValidationFor(null)} />
            <motion.div
              className="relative z-[71] w-full max-w-2xl rounded-lg border border-purple/20 bg-white/95 backdrop-blur p-0 shadow-xl"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-purple/20">
                <h2 className="text-lg font-semibold text-textDark">Validation Report</h2>
                <button onClick={() => setShowValidationFor(null)} className="p-1 rounded hover:bg-purple/10">
                  <X size={18} />
                </button>
              </div>
              <div className="p-5 max-h-[60vh] overflow-auto">
                {validationLines.length === 0 ? (
                  <div className="text-textDark/60">No validation messages.</div>
                ) : (
                  <ul className="list-disc pl-5 text-sm text-textDark/80 space-y-1">
                    {validationLines.map((ln, i) => <li key={i}>{ln}</li>)}
                  </ul>
                )}
              </div>
              <div className="px-5 py-3 border-t border-purple/20 flex justify-end">
                <button className="px-4 py-2 rounded-md border border-textDark/20" onClick={()=>setShowValidationFor(null)}>Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubmitFilesPage;
