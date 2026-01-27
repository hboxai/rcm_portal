import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SubmitSearchForm from '../components/search/SubmitSearchForm';
import SearchResults from '../components/search/SearchResults';
import { useAuth } from '../contexts/AuthContext';
import { VisitClaim, SearchFilters } from '../types/claim';
import { getAllSubmitClaims } from '../services/uploadService';
import { UploadCloud, User2, Building2, FileText, Hash, Copy } from 'lucide-react';

const SubmitFilesPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<VisitClaim[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [claimsPerPage, setClaimsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [lastSubmittedFilters, setLastSubmittedFilters] = useState<SearchFilters>({});

  useEffect(() => {
    if (!isAuthenticated && !authLoading) navigate('/login');
  }, [isAuthenticated, authLoading, navigate]);

  const mapRow = (r: any): VisitClaim => {
    const mapped: any = {
      id: String(r.claimId || r.bil_claim_submit_id || r.oa_claim_id || r.id || ''),
      claimId: String(r.claimId || r.bil_claim_submit_id || r.oa_claim_id || ''),
      memberId: String(r.patient_id || r.member_id || r.patientId || ''),
      patientName: r.patientName || (r.patientfirst ? `${r.patientfirst} ${r.patientlast || ''}`.trim() : ''),
      payer: String(r.prim_ins || r.payer || ''),
      billedAmount: Number(r.total_amt ?? r.charge_amt ?? r.totalcharges ?? 0),
      paidAmount: Number(r.prim_chk_amt ?? 0) || undefined,
      status: String(r.claim_status || r.status || ''),
      dos: r.dos || r.charge_dt || r.service_start || r.service_end || undefined,
      dateOfBirth: r.dateOfBirth || r.dob || undefined,
      cptCodes: r.cptCodes || (r.cpt_code ? [String(r.cpt_code)] : undefined),
  clinicName: r.facilityname || r.clinicName,
      providerName: r.providerName,
      billing_id: r.billing_id,
      prim_ins: r.prim_ins,
      prim_chk_det: r.prim_chk_det,
      oa_claim_id: r.oa_claim_id || r.oa_claimid,
    };
    (mapped as any).__raw = r;
    return mapped as VisitClaim;
  };

  const doSearch = async (page: number, baseFilters: SearchFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: claimsPerPage,
        claimId: baseFilters.billingId || baseFilters.claimId || undefined,
        patientName: baseFilters.patientName || [baseFilters.firstName, baseFilters.lastName].filter(Boolean).join(' ').trim() || undefined,
        status: baseFilters.status || undefined,
        clinicName: baseFilters.clinicName || undefined,
        dateOfBirth: baseFilters.dateOfBirth || undefined,
        payerName: baseFilters.payerName || undefined,
        cptCode: baseFilters.cptCode || undefined,
      } as any;
      const res = await getAllSubmitClaims(params);
      const rows: VisitClaim[] = (res.data || []).map(mapRow);
      setResults(rows);
      setTotalCount(res.totalCount || rows.length || 0);
      setCurrentPage(res.page || page);
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch submit claims');
      setResults([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (searchFilters: SearchFilters) => {
    setHasSearched(true);
    setLastSubmittedFilters(searchFilters);
    await doSearch(1, searchFilters);
  };

  const handlePageChange = (newPage: number) => {
    setHasSearched(true);
    doSearch(newPage, lastSubmittedFilters);
  };

  if (authLoading || !isAuthenticated) {
    if (!isAuthenticated) return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F4EFFF] to-white dark:from-gray-900 dark:to-gray-800 pt-24">
      <div className="p-4 md:p-8">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
            <h1 className="text-2xl font-semibold text-textDark dark:text-gray-100">Submit Files</h1>
            <div className="flex flex-col sm:flex-row gap-2 self-start md:self-auto">
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-purple text-white hover:bg-purple/90 border border-purple/30 shadow-sm"
                onClick={() => navigate('/upload?type=submit')}
              >
                <UploadCloud size={18} /> Upload Submit File
              </button>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-purple text-white hover:bg-purple/90 border border-purple/30 shadow-sm"
                onClick={() => navigate('/office-ally-status')}
              >
                <FileText size={18} /> Upload OA Status
              </button>
            </div>
          </div>
          <SubmitSearchForm onSearch={handleSearch} isLoading={isLoading} filters={filters} setFilters={setFilters} onClear={() => { setHasSearched(false); setResults([]); setTotalCount(0); }} />
          <div className="mt-4 flex items-center justify-end gap-2 text-textDark/80">
            <label htmlFor="submit-page-size" className="text-sm">Claims per page:</label>
            <select
              id="submit-page-size"
              className="text-sm px-2 py-1 rounded-md border border-purple/30 bg-white/90 text-textDark"
              value={claimsPerPage}
              onChange={(e) => {
                const newLimit = parseInt(e.target.value, 10);
                setClaimsPerPage(newLimit);
                if (hasSearched) {
                  // Re-run search with new limit from page 1
                  doSearch(1, lastSubmittedFilters);
                }
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-error-500/20 text-error-300 rounded-md text-center">
            <p>{error}</p>
          </div>
        )}

        <div className="mt-8">
          <SearchResults
            results={results}
            isLoading={isLoading}
            hasSearched={hasSearched}
            totalCount={totalCount}
            currentPage={currentPage}
            claimsPerPage={claimsPerPage}
            onPageChange={handlePageChange}
            buildDetailsLink={(claim) => `/submit-full-profile/${claim.id || claim.claimId || claim.billing_id}`}
            buildDetailsState={(claim) => ({ submitClaim: claim, raw: (claim as any)?.__raw })}
            renderCard={(claim) => {
              const raw = (claim as any)?.__raw || {};
              const first = raw.patientfirst || claim.patientName?.split(' ')[0] || '';
              const last = raw.patientlast || claim.patientName?.split(' ').slice(1).join(' ') || '';
              const initials = `${(first || '').slice(0, 1)}${(last || '').slice(0, 1)}`.toUpperCase();
              const facilityName = raw.facilityname || 'N/A';
              const payorStatus = raw.payor_status || 'N/A';
              const oaClaimId = raw.oa_claimid || raw.oa_claim_id || 'N/A';
              const payorRefId = raw.payor_reference_id || 'N/A';
              const cycle = Number(raw.cycle || (claim as any).cycle || 1);

              const statusChip = (() => {
                const s = String(payorStatus || '').toLowerCase();
                if (!s || s === 'n/a') return 'bg-slate-100 text-slate-700 border border-slate-200';
                if (s.includes('accept') || s.includes('paid') || s.includes('approved') || s.includes('success')) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                if (s.includes('reject') || s.includes('den')) return 'bg-rose-50 text-rose-700 border border-rose-200';
                if (s.includes('pend') || s.includes('review')) return 'bg-amber-50 text-amber-800 border border-amber-200';
                return 'bg-blue-50 text-blue-700 border border-blue-200';
              })();

              const copy = async (val: string) => {
                try { await navigator.clipboard.writeText(val); } catch { /* clipboard may be unavailable */ }
              };

              return (
                <div className="rounded-xl overflow-hidden border border-purple/20 bg-gradient-to-br from-white to-purple/5 shadow-sm">
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-purple/10 text-purple border border-purple/20 flex items-center justify-center font-semibold">
                          {initials || <User2 size={18} />}
                        </div>
                        <div>
                          <div className="mt-0.5 text-xl font-semibold text-textDark">{first} {last}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusChip}`}>{payorStatus}</span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200" title="Claim cycle">Cycle {isFinite(cycle) && cycle > 0 ? cycle : 1}</span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-purple/10 bg-white/70 p-3">
                        <div className="flex items-center text-textDark/60 text-xs uppercase tracking-wider gap-1"><Building2 size={14}/> Facility</div>
                        <div className="mt-1 font-medium text-textDark" title={facilityName}>{facilityName}</div>
                      </div>
                      <div className="rounded-lg border border-purple/10 bg-white/70 p-3">
                        <div className="flex items-center text-textDark/60 text-xs uppercase tracking-wider gap-1"><FileText size={14}/> OA Claim ID</div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <div className="font-mono text-sm text-textDark" title={oaClaimId}>{oaClaimId}</div>
                          {oaClaimId && oaClaimId !== 'N/A' && (
                            <button className="text-textDark/60 hover:text-textDark" onClick={() => copy(oaClaimId)} title="Copy">
                              <Copy size={16}/>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="rounded-lg border border-purple/10 bg-white/70 p-3">
                        <div className="flex items-center text-textDark/60 text-xs uppercase tracking-wider gap-1"><Hash size={14}/> Payor Ref ID</div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <div className="font-mono text-sm text-textDark" title={payorRefId}>{payorRefId}</div>
                          {payorRefId && payorRefId !== 'N/A' && (
                            <button className="text-textDark/60 hover:text-textDark" onClick={() => copy(payorRefId)} title="Copy">
                              <Copy size={16}/>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        className="px-4 py-2 rounded-md bg-purple text-white hover:bg-purple/90 border border-purple/30 shadow-sm"
                        onClick={() => navigate(`/submit-full-profile/${claim.id || claim.claimId || claim.billing_id}`, { state: { submitClaim: claim, raw } })}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            }}
          />
        </div>

      </div>
    </div>
  );
};

export default SubmitFilesPage;
