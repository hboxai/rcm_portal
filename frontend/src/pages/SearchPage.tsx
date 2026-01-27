import React, { useEffect, useState } from 'react';
import SearchForm from '../components/search/SearchForm';
import SearchResults from '../components/search/SearchResults';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { SearchFilters, VisitClaim, PaginatedClaimsResponse } from '../types/claim';
import { User2, Building2, FileText, Hash, Copy, UploadCloud } from 'lucide-react';
import { getAllReimburseClaims } from '../services/uploadService';

const SearchPage: React.FC = () => {
  const [searchResults, setSearchResults] = useState<VisitClaim[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [claimsPerPage, setClaimsPerPage] = useState(10);
  const [totalClaimCount, setTotalClaimCount] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({});
  const [filters, setFilters] = useState<SearchFilters>({});

  // Auth gate + initial auto-load of reimburse claims (page 1) so list isn't empty
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      navigate('/login');
    } else if (isAuthenticated) {
      // Verify token is still valid by checking for auth errors
      if (error && error.includes('Authentication required')) {
        navigate('/login');
      }
      // Auto-load first page if user hasn't searched yet
      if (!hasSearched && !isLoading) {
        (async () => {
          try {
            setIsLoading(true);
            const res: PaginatedClaimsResponse = await getAllReimburseClaims({ page: 1, limit: claimsPerPage });
            setSearchResults((res.data as any[]) as VisitClaim[]);
            setTotalClaimCount(res.totalCount || 0);
            setCurrentPage(res.page || 1);
            setClaimsPerPage(res.limit || claimsPerPage);
            setHasSearched(true);
          } catch (e: any) {
            setError(e?.message || 'Failed to fetch reimburse claims');
            setSearchResults([]);
            setTotalClaimCount(0);
            setCurrentPage(1);
          } finally {
            setIsLoading(false);
          }
        })();
      }
    }
  }, [isAuthenticated, authLoading, navigate, error, hasSearched, isLoading, claimsPerPage]);
  const handleSearch = async (searchFilters: SearchFilters) => {
    setHasSearched(true);
    setCurrentFilters(searchFilters);
    setIsLoading(true);
    setError(null);
    try {
  const res: PaginatedClaimsResponse = await getAllReimburseClaims({ ...searchFilters, page: 1, limit: claimsPerPage });
      setSearchResults((res.data as any[]) as VisitClaim[]);
      setTotalClaimCount(res.totalCount || 0);
      setCurrentPage(res.page || 1);
      setClaimsPerPage(res.limit || claimsPerPage);
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch reimburse claims');
      setSearchResults([]);
      setTotalClaimCount(0);
      setCurrentPage(1);
    } finally {
      setIsLoading(false);
    }
  };
  const handleClear = () => {
    // Reset the search results
    setHasSearched(false);
    setCurrentFilters({});
    // Reset form fields to empty state
    setFilters({
      patientId: '',
      billingId: '',
      dos: '',
      firstName: '',
      lastName: '',
      payerName: '',
      dateOfBirth: '',
      cptCode: '',
    });
    // No need to call searchClaims - setting hasSearched to false will hide the results
  };

  const handlePageChange = async (newPage: number) => {
    setHasSearched(true);
    setIsLoading(true);
    setError(null);
    try {
  const res: PaginatedClaimsResponse = await getAllReimburseClaims({ ...currentFilters, page: newPage, limit: claimsPerPage });
      setSearchResults((res.data as any[]) as VisitClaim[]);
      setTotalClaimCount(res.totalCount || 0);
      setCurrentPage(res.page || newPage);
      setClaimsPerPage(res.limit || claimsPerPage);
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch reimburse claims');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-olive-green to-earth-yellow flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-transparent border-t-sienna border-r-sienna rounded-full animate-spin"></div>
          <p className="mt-4 text-textDark/80">Verifying your session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background-900 to-background-800 text-white pt-24">
      <div className="p-4 md:p-8">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
            <h1 className="text-2xl font-semibold text-textDark">Reimburse Files</h1>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-purple text-white hover:bg-purple/90 border border-purple/30 shadow-sm"
                  onClick={() => navigate('/upload?type=reimburse')}
                >
                  <UploadCloud size={18} /> Upload Reimburse File
                </button>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-purple text-white hover:bg-purple/90 border border-purple/30 shadow-sm"
                  onClick={() => navigate('/era-inbox')}
                  title="Upload ERA PDF and review matches"
                >
                  <FileText size={18} /> ERA Inbox
                </button>
              </div>
          </div>

          <SearchForm 
            onSearch={handleSearch} 
            isLoading={isLoading} 
            filters={filters} 
            setFilters={setFilters} 
            onClear={handleClear} 
          />
          <div className="mt-4 flex items-center justify-end gap-2 text-textDark/80">
            <label htmlFor="page-size" className="text-sm">Claims per page:</label>
            <select
              id="page-size"
              className="text-sm px-2 py-1 rounded-md border border-purple/30 bg-white/90 text-textDark"
              value={claimsPerPage}
              onChange={(e) => {
                const newLimit = parseInt(e.target.value, 10);
                setClaimsPerPage(newLimit);
                // If we have already searched, re-run page 1 with new limit
                if (hasSearched) {
                  handleSearch(currentFilters);
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

        {/* Display error message if there is an error from the context */}
        {error && (
          <div className="mb-4 p-4 bg-error-500/20 text-error-300 rounded-md text-center">
            <p>{error}</p>
          </div>
        )}

        <div className="mt-8">
          <SearchResults
            results={searchResults}
            isLoading={isLoading}
            hasSearched={hasSearched}
            totalCount={totalClaimCount}
            currentPage={currentPage}
            claimsPerPage={claimsPerPage}
            onPageChange={handlePageChange}
            renderCard={(claim) => {
              // Match Submit Files card style and fields as closely as possible
              const patientName = (claim as any).patientName || `${(claim as any).first_name || ''} ${(claim as any).last_name || ''}`.trim();
              const [first = '', ...rest] = patientName.split(' ').filter(Boolean);
              const last = rest.join(' ');
              const initials = `${(first || '').slice(0, 1)}${(last || '').slice(0, 1)}`.toUpperCase();
              const facilityName = (claim as any).clinicName || (claim as any).facilityname || 'N/A';
              const payorStatus = (claim as any).status || (claim as any).claim_status || 'N/A';
              const oaClaimId = (claim as any).oa_claim_id || (claim as any).oa_claimid || (claim as any).claimId || 'N/A';
              const payorRefId = (claim as any).payor_reference_id || 'N/A';

              const statusChip = (() => {
                const s = String(payorStatus || '').toLowerCase();
                if (!s || s === 'n/a') return 'bg-slate-100 text-slate-700 border border-slate-200';
                if (s.includes('accept') || s.includes('paid') || s.includes('approved') || s.includes('success')) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                if (s.includes('reject') || s.includes('den')) return 'bg-rose-50 text-rose-700 border border-rose-200';
                if (s.includes('pend') || s.includes('review')) return 'bg-amber-50 text-amber-800 border border-amber-200';
                return 'bg-blue-50 text-blue-700 border border-blue-200';
              })();

              const copy = async (val: string) => {
                try { await navigator.clipboard.writeText(val); } catch {}
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
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusChip}`}>{payorStatus}</span>
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
                            <button className="text-textDark/60 hover:text-textDark" onClick={() => copy(String(oaClaimId))} title="Copy">
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
                            <button className="text-textDark/60 hover:text-textDark" onClick={() => copy(String(payorRefId))} title="Copy">
                              <Copy size={16}/>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        className="px-4 py-2 rounded-md bg-purple text-white hover:bg-purple/90 border border-purple/30 shadow-sm"
                        onClick={() => navigate(`/profile/${(claim as any).id || (claim as any).claimId || (claim as any).billing_id}`)}
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

export default SearchPage;
