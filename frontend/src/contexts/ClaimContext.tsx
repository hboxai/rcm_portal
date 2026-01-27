import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { VisitClaim, KPIData, SearchFilters } from '../types/claim';
import { fetchClaims, fetchClaimById, updateClaim as updateClaimAPI } from '../services/claimService';
import { useAuth } from './AuthContext';

// Mock KPI data for demonstration
const mockKPIData: KPIData = {
  totalCheckNumbers: 5,
  totalVisitIds: 5,
  postedVisitIds: 3,
  pendingPosting: 2
};

interface ClaimContextType {
  claims: VisitClaim[];
  kpiData: KPIData;
  searchResults: VisitClaim[];
  currentClaim: VisitClaim | null;
  isLoading: boolean;
  error: string | null;
  searchClaims: (filters: SearchFilters, page?: number, limit?: number) => void;
  getClaim: (id: string) => Promise<VisitClaim | null>;
  updateClaim: (updatedClaimData: Partial<VisitClaim>) => Promise<VisitClaim | null>;
  addNote: (claimId: string, note: string) => void;
  totalClaimCount: number;
  currentPage: number;
  claimsPerPage: number;
  totalPages: number;
  hasSearched: boolean;
  setHasSearched: React.Dispatch<React.SetStateAction<boolean>>;
}

const ClaimContext = createContext<ClaimContextType | undefined>(undefined);

// Helper function to map API data to VisitClaim interface
const mapApiClaimToVisitClaim = (apiClaim: any): VisitClaim => {
  // Ensure apiClaim is not null or undefined
  if (!apiClaim) {
    console.error('Received null or undefined API claim data for mapping.');
    // Return a default error object, ensuring ID is a string
    return {
      id: `error-null-apiclaim-${Date.now()}`,
      claim_status: 'Error',
      patientId: '',
      patientName: 'Unknown Patient',
      visitId: 'Unknown',
      dob: '',
      dos: '',
      checkNumber: '',
      amount: 0,
      status: 'Error',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: [],
      billing_id: null,
      oa_claim_id: '',
      oa_visit_id: '',
      charge_dt: null,
      charge_amt: null,
      allowed_amt: null,
      allowed_add_amt: null,
      allowed_exp_amt: null,
      total_amt: null,
      charges_adj_amt: null,
      write_off_amt: null,
      bal_amt: null,
      reimb_pct: null,
      claim_status_type: '',
      prim_ins: '',
      prim_amt: null,
      prim_post_dt: null,
      prim_chk_det: '',
      prim_recv_dt: null,
      prim_chk_amt: null,
      prim_cmt: '',
      sec_ins: '',
      sec_amt: null,
      sec_post_dt: null,
      sec_chk_det: '',
      sec_recv_dt: null,
      sec_chk_amt: null,
      sec_cmt: '',
      sec_denial_code: '',
      pat_amt: null,
      pat_recv_dt: null,
      dateOfBirth: '',
      billedAmount: 0,
      paidAmount: 0,
      claimId: '',
      memberId: '',
      payer: '',
      cptCodes: [],
      icdCodes: [],
    } as VisitClaim;
  }
  
  let mappedId: string;
  if (apiClaim.id !== undefined && apiClaim.id !== null) {
    mappedId = String(apiClaim.id);
  } else if (apiClaim.oa_claim_id) { 
    mappedId = String(apiClaim.oa_claim_id);
  } else if (apiClaim.billing_id !== undefined && apiClaim.billing_id !== null) {
    mappedId = String(apiClaim.billing_id);
  } else {
    console.error("Critical: No valid primary ID (id, oa_claim_id, billing_id) found in API response for claim. This may lead to issues.", apiClaim);
    mappedId = `temp-id-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }
  
  // Map all fields from the SQL query to the VisitClaim interface
  return {
    id: mappedId, // Ensure id is always a string and present
    billing_id: apiClaim.billing_id || apiClaim.cpt_id || null,
    cpt_code: apiClaim.cpt_code || '', // Not in VisitClaim, cptCodes array is used
    icd_code: apiClaim.icd_code || '', // Not in VisitClaim, icdCodes array is used
    
    // Claim & Billing Information
    oa_claim_id: apiClaim.oa_claim_id || '',
    oa_visit_id: apiClaim.oa_visit_id || '',
    charge_dt: apiClaim.charge_dt || null,
    charge_amt: apiClaim.charge_amt !== undefined ? apiClaim.charge_amt : null,
    allowed_amt: apiClaim.allowed_amt !== undefined ? apiClaim.allowed_amt : null,
    allowed_add_amt: apiClaim.allowed_add_amt !== undefined ? apiClaim.allowed_add_amt : null,
    allowed_exp_amt: apiClaim.allowed_exp_amt !== undefined ? apiClaim.allowed_exp_amt : null,
    total_amt: apiClaim.total_amt !== undefined ? apiClaim.total_amt : null,
    charges_adj_amt: apiClaim.charges_adj_amt !== undefined ? apiClaim.charges_adj_amt : null,
    write_off_amt: apiClaim.write_off_amt !== undefined ? apiClaim.write_off_amt : null,
    bal_amt: apiClaim.bal_amt !== undefined ? apiClaim.bal_amt : null,
    reimb_pct: apiClaim.reimb_pct !== undefined ? apiClaim.reimb_pct : null,
    claim_status: apiClaim.claim_status || 'Pending',
    claim_status_type: apiClaim.claim_status_type || '',
    
    // Primary Insurance
    prim_ins: apiClaim.prim_ins || '',
    prim_amt: apiClaim.prim_amt !== undefined ? apiClaim.prim_amt : null,
    prim_post_dt: apiClaim.prim_post_dt || null,
    prim_chk_det: apiClaim.prim_chk_det || '',
    prim_recv_dt: apiClaim.prim_recv_dt || null,
    prim_chk_amt: apiClaim.prim_chk_amt !== undefined ? apiClaim.prim_chk_amt : null,
    prim_cmt: apiClaim.prim_cmt || '',
    
    // Secondary Insurance
    sec_ins: apiClaim.sec_ins || '',
    sec_amt: apiClaim.sec_amt !== undefined ? apiClaim.sec_amt : null,
    sec_post_dt: apiClaim.sec_post_dt || null,
    sec_chk_det: apiClaim.sec_chk_det || '',
    sec_recv_dt: apiClaim.sec_recv_dt || null,
    sec_chk_amt: apiClaim.sec_chk_amt !== undefined ? apiClaim.sec_chk_amt : null,
    sec_cmt: apiClaim.sec_cmt || '',
    sec_denial_code: apiClaim.sec_denial_code || '',
    
    // Patient Payment
    pat_amt: apiClaim.pat_amt !== undefined ? apiClaim.pat_amt : null,
    pat_recv_dt: apiClaim.pat_recv_dt || null,
      // Frontend fields (mapped for compatibility with UI components)
  visitId: apiClaim.oa_visit_id || `V-${mappedId}`, 
  patientName: (apiClaim.patientname || `${apiClaim.first_name || ''} ${apiClaim.last_name || ''}`.trim() || '').trim() || 'Unknown Patient',
    dob: apiClaim.date_of_birth || '', // Retained for potential direct use, though dateOfBirth is preferred
    dateOfBirth: apiClaim.date_of_birth || '', 
  dos: apiClaim.service_end || apiClaim.service_start || apiClaim.charge_dt || '',
    checkNumber: apiClaim.prim_chk_det || apiClaim.sec_chk_det || '', // Not in VisitClaim    amount: apiClaim.charge_amt !== undefined && apiClaim.charge_amt !== null ? apiClaim.charge_amt : 0, // Not in VisitClaim, use billedAmount
    status: apiClaim.claim_status || 'Pending',
    billedAmount: apiClaim.charge_amt !== undefined && apiClaim.charge_amt !== null ? apiClaim.charge_amt : 0,
    paidAmount: (
      (apiClaim.prim_chk_amt !== undefined && apiClaim.prim_chk_amt !== null ? Number(apiClaim.prim_chk_amt) : 0) +
      (apiClaim.sec_chk_amt !== undefined && apiClaim.sec_chk_amt !== null ? Number(apiClaim.sec_chk_amt) : 0) +
      (apiClaim.pat_amt !== undefined && apiClaim.pat_amt !== null ? Number(apiClaim.pat_amt) : 0)
    ),
    claimId: apiClaim.oa_claim_id || `C-${mappedId}`,
    memberId: apiClaim.patient_id ? String(apiClaim.patient_id) : (apiClaim.patient_emr_no ? String(apiClaim.patient_emr_no) : ''),
    payer: apiClaim.prim_ins || '',
    cptCodes: apiClaim.cpt_code ? (Array.isArray(apiClaim.cpt_code) ? apiClaim.cpt_code.map(String) : [String(apiClaim.cpt_code)]) : [],
    icdCodes: apiClaim.icd_code ? (Array.isArray(apiClaim.icd_code) ? apiClaim.icd_code.map(String) : [String(apiClaim.icd_code)]) : [],
    createdAt: apiClaim.charge_dt || new Date().toISOString(),
    updatedAt: apiClaim.prim_post_dt || apiClaim.sec_post_dt || new Date().toISOString(),
  notes: Array.isArray(apiClaim.notes) ? apiClaim.notes.map(String) : (apiClaim.notes ? [String(apiClaim.notes)] : []),
  clinicName: apiClaim.clinicname || apiClaim.facilityname || '',
    providerName: apiClaim.provider_name || ''
  } as VisitClaim; // Added 'as VisitClaim' for stricter type checking if needed, but ensure all fields match
};

export const ClaimProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [claims, setClaims] = useState<VisitClaim[]>([]);
  const [kpiData] = useState<KPIData>(mockKPIData);
  const [searchResults, setSearchResults] = useState<VisitClaim[]>([]);
  const [currentClaim, setCurrentClaim] = useState<VisitClaim | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState<boolean>(false);
  const [totalClaimCount, setTotalClaimCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [claimsPerPage, setClaimsPerPage] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  // Load initial data when component mounts
  useEffect(() => {
    const controller = new AbortController();
    
    // Only load initial claims if user is authenticated and initial load hasn't been done
    if (!initialLoadDone && isAuthenticated) {
      const loadInitialClaims = async (page = 1, limit = 10) => {
        try {
          setIsLoading(true);
          setError(null);
          
          // Pass empty object for filters, and page/limit as separate arguments
          const response = await fetchClaims({}, page, limit);
          
          if (response.success && Array.isArray(response.data)) {
            const mappedClaims = response.data.map(mapApiClaimToVisitClaim);
            setClaims(mappedClaims);
            setSearchResults(mappedClaims); // Initialize search results with the first page
            setTotalClaimCount(response.totalCount || 0);
            setCurrentPage(response.page || 1);
            setClaimsPerPage(response.limit || 10);
            setTotalPages(response.totalPages || 0);
          } else {
            setError(response.message || 'Failed to fetch claims');
            setClaims([]);
            setSearchResults([]);
            setTotalClaimCount(0);
            setTotalPages(0);
          }
          setInitialLoadDone(true);
        } catch (_err: any) {
          const errorMessage = 'Error connecting to the claims API';
          setError(errorMessage);
          setClaims([]);
          setSearchResults([]);
          setTotalClaimCount(0);
          setTotalPages(0);
          setInitialLoadDone(true);
        } finally {
          setIsLoading(false);
        }
      };

      loadInitialClaims(currentPage, claimsPerPage);
    }
      // Cleanup function to abort any ongoing fetch when component unmounts
    return () => {
      controller.abort();
    };
  }, [initialLoadDone, currentPage, claimsPerPage, isAuthenticated, user]);

  // Debounce search function to prevent rapid consecutive API calls
  const searchClaims = useCallback(async (filtersArg: SearchFilters, pageArg?: number, limitArg?: number) => {
    try {
      setIsLoading(true);
      setError(null);
      const page = pageArg || filtersArg.page || 1;
      const limit = limitArg || filtersArg.limit || claimsPerPage;
      const response = await fetchClaims(filtersArg, page, limit);
      if (response.success && Array.isArray(response.data)) {
        const mapped = response.data.map(mapApiClaimToVisitClaim);
        setSearchResults(mapped);
        setTotalClaimCount(response.totalCount || 0);
        setCurrentPage(response.page || page);
        setClaimsPerPage(response.limit || limit);
        setTotalPages(response.totalPages || Math.ceil((response.totalCount || 0) / (response.limit || limit)));
        setHasSearched(true);
      } else {
        setError(response.message || response.error || 'Failed to fetch claims');
        setSearchResults([]);
        setTotalClaimCount(0);
        setCurrentPage(1);
        setTotalPages(1);
        setHasSearched(true);
      }
    } catch (err: any) {
      setError(err?.message || 'Error connecting to the claims API');
      setSearchResults([]);
      setTotalClaimCount(0);
      setCurrentPage(1);
      setTotalPages(1);
      setHasSearched(true);
    } finally {
      setIsLoading(false);
    }
  }, [user, claimsPerPage]); // Dependencies remain user and claimsPerPage, setters are stable

  // Use local cache for claim fetching when possible
  const getClaim = useCallback(async (id: string): Promise<VisitClaim | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchClaimById(id);
      if (!data) {
        setError('Claim not found');
        return null;
      }
      const mapped = mapApiClaimToVisitClaim(data);
      setCurrentClaim(mapped);
      return mapped;
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch claim');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Helper function to ensure dates are properly formatted before sending to API
  const formatDateFields = useCallback((data: any) => {
    const normalize = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);
    return {
      ...data,
      prim_post_dt: normalize(data.prim_post_dt),
      prim_recv_dt: normalize(data.prim_recv_dt),
      sec_post_dt: normalize(data.sec_post_dt),
      sec_recv_dt: normalize(data.sec_recv_dt),
      pat_recv_dt: normalize(data.pat_recv_dt),
    };
  }, []);

  // Optimized update function with improved error handling to ensure edits are saved
  const updateClaim = useCallback(async (updatedClaimData: Partial<VisitClaim>): Promise<VisitClaim | null> => {
    try {
      if (!updatedClaimData || !updatedClaimData.id) {
        setError('Invalid claim data: missing id');
        return null;
      }
      setIsLoading(true);
      setError(null);
      const id = String(updatedClaimData.id);
      const allowedKeys = [
        'allowed_amt','allowed_add_amt','allowed_exp_amt','prim_ins','prim_amt','prim_post_dt','prim_chk_det','prim_recv_dt','prim_chk_amt','prim_cmt',
        'sec_ins','sec_amt','sec_post_dt','sec_chk_det','sec_recv_dt','sec_chk_amt','sec_cmt','sec_denial_code','pat_amt','pat_recv_dt','total_amt','write_off_amt','bal_amt','reimb_pct','claim_status','claim_status_type','payor_reference_id','claim_id'
      ] as const;
      const body: any = {};
      const formatted = formatDateFields(updatedClaimData as any);
      for (const k of allowedKeys) {
        if (k in formatted && (formatted as any)[k] !== undefined) body[k] = (formatted as any)[k];
      }
      const resp = await updateClaimAPI(id, body);
      if (!resp.success || !resp.data) {
        setError(resp.message || 'Failed to update claim');
        return null;
      }
      const mapped = mapApiClaimToVisitClaim(resp.data);
      setCurrentClaim(mapped);
      setClaims(prev => prev.map(c => (c.id === mapped.id ? mapped : c)));
      setSearchResults(prev => prev.map(c => (c.id === mapped.id ? mapped : c)));
      return mapped;
    } catch (err: any) {
      setError(err?.message || 'Failed to update claim');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [formatDateFields]);

  const addNote = useCallback((claimId: string, note: string) => {
    // Ensure currentClaim and its id are defined and match claimId before proceeding
    if (currentClaim && typeof currentClaim.id !== 'undefined' && String(currentClaim.id) === claimId) {
      const updatedClaim = {
        ...currentClaim,
        notes: currentClaim.notes ? [...currentClaim.notes, note] : [note],
        updatedAt: new Date().toISOString()
      };
      setCurrentClaim(updatedClaim);
      
      setClaims(prevClaims => 
        prevClaims.map(c => c.id === updatedClaim.id ? updatedClaim : c)
      );
      
      setSearchResults(prevResults => 
        prevResults.map(c => c.id === updatedClaim.id ? updatedClaim : c)
      );
    }
  }, [currentClaim]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    claims,
    kpiData,
    searchResults,
    currentClaim,
    isLoading,
    error,
    searchClaims,
    getClaim,
    updateClaim,
    addNote,
    totalClaimCount, // Added for pagination
    currentPage, // Added for pagination
    claimsPerPage, // Added for pagination
    totalPages, // Added for pagination
    hasSearched, // Provide hasSearched
    setHasSearched, // Provide setHasSearched
  }), [
    claims, 
    kpiData, 
    searchResults, 
    currentClaim, 
    isLoading, 
    error, 
    searchClaims, 
    getClaim, 
    updateClaim, 
    addNote,
    totalClaimCount, // Added for pagination
    currentPage, // Added for pagination
    claimsPerPage, // Added for pagination
    totalPages, // Added for pagination
    hasSearched, // Include in dependencies
    setHasSearched, // Include in dependencies
  ]);

  return (
    <ClaimContext.Provider value={contextValue}>
      {children}
    </ClaimContext.Provider>
  );
};

export const useClaims = () => {
  const context = useContext(ClaimContext);
  if (context === undefined) {
    throw new Error('useClaims must be used within a ClaimProvider');
  }
  return context;
};
