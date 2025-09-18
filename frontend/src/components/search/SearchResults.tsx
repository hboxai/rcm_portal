import React from 'react';
import { AlertCircle, Search } from 'lucide-react'; // Added Search
import { VisitClaim } from '../../types/claim';
import { Link } from 'react-router-dom';
import { formatDateString } from '../../utils/format';
import { getClaimStatusStyle } from '../../constants/claimStatus';

interface SearchResultsProps {
  results: VisitClaim[];
  isLoading: boolean;
  hasSearched: boolean;
  totalCount: number;
  currentPage: number;
  claimsPerPage: number;
  onPageChange: (page: number) => void;
  // Optional: customize the destination for the details link (used by Submit Files page)
  buildDetailsLink?: (claim: VisitClaim) => string;
  buildDetailsState?: (claim: VisitClaim) => any;
  // Optional: provide a custom card renderer per claim (full control of card UI)
  renderCard?: (claim: VisitClaim) => React.ReactNode;
}

const SearchResults: React.FC<SearchResultsProps> = ({ 
  results, 
  isLoading,
  hasSearched,
  totalCount,
  currentPage,
  claimsPerPage,
  onPageChange,
  buildDetailsLink,
  buildDetailsState,
  renderCard,
}) => {  
  const totalPages = Math.ceil(totalCount / claimsPerPage);
  const pageCount = results.length; // claims on this page
  const startIdx = totalCount === 0 ? 0 : (currentPage - 1) * claimsPerPage + 1;
  const endIdx = totalCount === 0 ? 0 : startIdx + pageCount - 1;

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      onPageChange(newPage);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card min-h-48 flex items-center justify-center rounded-xl bg-white/95 backdrop-blur-sm border border-purple/20">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-purple border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-textDark/70">Searching for claims...</p>
        </div>
      </div>
    );
  }
  if (!isLoading && hasSearched && results.length === 0) {
    return (
      <div className="glass-card min-h-48 flex items-center justify-center rounded-xl bg-white/95 backdrop-blur-sm border border-purple/20">
        <div className="text-center text-textDark/70">
          <AlertCircle className="h-10 w-10 mx-auto mb-4 text-purple/40" />
          <h3 className="text-lg font-medium mb-1">No results found</h3>
          <p>Try adjusting your search parameters</p>
          <p className="mt-3 text-xs text-textDark/50">Check that your backend server is running and accessible via /api</p>
        </div>
      </div>
    );
  }
  if (!hasSearched) {
    return (
      <div className="glass-card min-h-48 flex items-center justify-center rounded-xl bg-white/90 backdrop-blur-sm border border-purple/20">
        <div className="text-center text-textDark/70">
          <Search className="h-10 w-10 mx-auto mb-4 text-purple/60" />
          <h3 className="text-lg font-medium mb-1">Search for claims</h3>
          <p>Use the form above to find specific claims</p>
        </div>
      </div>
    );
  }

  console.log('Rendering search results:', results);
  return (
    <div className="glass-card min-h-48 rounded-xl p-6 bg-white/90 backdrop-blur-sm border border-purple/20">
      {/* Page summary */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-textDark/80">
        <div className="text-sm">Claims on this page: <span className="font-semibold text-textDark">{pageCount}</span></div>
        <div className="text-sm">Showing <span className="font-semibold text-textDark">{startIdx}</span>–<span className="font-semibold text-textDark">{endIdx}</span> of <span className="font-semibold text-textDark">{totalCount}</span></div>
      </div>
      <div className="space-y-4">
  {results.map((claim) => (
          renderCard ? (
            <React.Fragment key={(claim.id || claim.claimId || claim.billing_id) as any}>
              {renderCard(claim)}
            </React.Fragment>
          ) : (
          <div key={claim.id as any} className="glass-card rounded-xl overflow-hidden bg-white/60 border border-purple/10 hover:bg-white/80 transition-all duration-200">
            <div className="p-4">              {/* Patient Name with Provider Name beside it */}
              <div className="mb-4 flex justify-between items-center">
                <h3 className="text-xl font-medium text-textDark">
                  {claim.patientName} 
                  {claim.providerName && (
                    <span className="text-sm text-textDark/70 ml-2">
                      | Provider: {claim.providerName}
                    </span>
                  )}
                </h3>
              </div>
              
              {/* New layout based on requirements */}
              <div className="space-y-3">
                {/* Line 1: Patient ID, Billing ID, CPT Code */}
                <div className="flex flex-wrap gap-x-6 gap-y-2 p-2 bg-purple/5 rounded-lg">
                  <div>
                    <span className="text-textDark/60 text-xs uppercase tracking-wider font-medium">Patient ID:</span>
                    <span className="text-textDark ml-1 font-medium">{claim.memberId || claim.patientId || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-textDark/60 text-xs uppercase tracking-wider font-medium">Billing ID:</span>
                    <span className="text-textDark ml-1 font-medium">{claim.billing_id || claim.claimId || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-textDark/60 text-xs uppercase tracking-wider font-medium">CPT Code:</span>
                    <span className="text-pink ml-1 font-medium">{claim.cptCodes && claim.cptCodes.length > 0 ? claim.cptCodes.join(', ') : 'N/A'}</span>
                  </div>
                </div>
                
                {/* Line 2: DOB, DOS, Claim Status */}
                <div className="flex flex-wrap gap-x-6 gap-y-2 p-2 bg-purple/5 rounded-lg">
                  <div>
                    <span className="text-textDark/60 text-xs uppercase tracking-wider font-medium">Date of Birth:</span>
                    <span className="text-textDark ml-1">{formatDateString(claim.dateOfBirth)}</span>
                  </div>
                  <div>
                    <span className="text-textDark/60 text-xs uppercase tracking-wider font-medium">Date of Service:</span>
                    <span className="text-textDark ml-1">{formatDateString(claim.dos)}</span>
                  </div>
                  <div>
                    <span className="text-textDark/60 text-xs uppercase tracking-wider font-medium">Claim Status:</span>
                    <span className={`inline-block px-2 py-0.5 rounded text-sm ml-1 ${getClaimStatusStyle(claim.status)}`}>
                      {claim.status || 'Not Set'}
                    </span>
                  </div>
                </div>
                
                {/* Additional Information */}
                <div className="flex flex-wrap gap-x-6 gap-y-2 p-2">
                  <div>
                    <span className="text-textDark/60 text-xs uppercase tracking-wider font-medium">Payer Name:</span>
                    <span className="text-textDark ml-1">{claim.payer || claim.prim_ins || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-textDark/60 text-xs uppercase tracking-wider font-medium">Clinic Name:</span>
                    <span className="text-textDark ml-1">{claim.clinicName || 'N/A'}</span>
                  </div>
                </div>
              </div>
                {/* View Details link */}
              <div className="text-right">
                <Link
                  to={buildDetailsLink ? buildDetailsLink(claim) : `/profile/${claim.id || claim.claimId || claim.billing_id}`}
                  state={buildDetailsState ? buildDetailsState(claim) : undefined}
                  className="inline-flex items-center px-4 py-2 rounded-md bg-purple text-white hover:bg-purple/90 border border-purple/30 shadow-sm text-sm font-medium"
                >
                  View Details
                </Link>
              </div>
            </div>
          </div>
          )
        ))}
      </div>      {/* Pagination Controls */}
      {totalPages > 0 && (
        <div className="mt-8 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 sm:space-x-4 p-4 bg-white/80 rounded-lg shadow-md border border-purple/20">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-purple to-purple/80 hover:from-purple/90 hover:to-purple/70 text-white font-semibold rounded-lg shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple focus:ring-opacity-75"
          >
            Previous
          </button>
          <span className="text-textDark text-sm font-medium">
            Page <span className="font-bold text-purple">{currentPage}</span> of <span className="font-bold text-purple">{totalPages}</span>
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-purple to-purple/80 hover:from-purple/90 hover:to-purple/70 text-white font-semibold rounded-lg shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple focus:ring-opacity-75"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchResults;
