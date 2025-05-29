import React from 'react';
import { AlertCircle, Search } from 'lucide-react'; // Added Search
import { VisitClaim } from '../../types/claim';
import { Link } from 'react-router-dom';

interface SearchResultsProps {
  results: VisitClaim[];
  isLoading: boolean;
  hasSearched: boolean;
  totalCount: number;
  currentPage: number;
  claimsPerPage: number;
  onPageChange: (page: number) => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({ 
  results, 
  isLoading,
  hasSearched,
  totalCount,
  currentPage,
  claimsPerPage,
  onPageChange
}) => {
  // Format date for display
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  // Determine status display style based on the status
  const getStatusDisplayStyle = (status: string | undefined) => {
    if (!status) return 'bg-gray-600/30 text-white/70';
    
    switch (status) {      case 'Insurance Paid':
      case 'Claim not filed':
      case 'Posted':
        return 'bg-green/20 text-green';
      case 'Prim Denied':
      case 'Sec Denied. Prim Paid more than Allowed amt':
      case 'Patient Deceased':
      case 'Rejected':
        return 'bg-red/20 text-red';
      case 'Prim Pymt Pending':
      case 'Sec Pymt Pending':
      case 'Claim not received from HBox':
      case 'Pending':
        return 'bg-yellow/20 text-yellow';
      default:
        return 'bg-blue/20 text-blue';
    }
  };

  const totalPages = Math.ceil(totalCount / claimsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      onPageChange(newPage);
    }
  };

  if (isLoading) {    return (
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
      <div className="space-y-4">
        {results.map((claim) => (
          <div key={claim.id} className="glass-card rounded-xl overflow-hidden bg-white/60 border border-purple/10 hover:bg-white/80 transition-all duration-200">
            <div className="p-4">
              {/* Patient Name */}
              <div className="mb-4">
                <h3 className="text-xl font-medium text-textDark">{claim.patientName}</h3> {/* Changed from first_name and last_name to patientName */}
              </div>
              
              {/* Three columns of data */}
              <div className="grid grid-cols-3 mb-3 gap-4">
                <div>
                  <div className="mb-2">
                    <p className="text-textDark/60 text-xs uppercase tracking-wider font-medium">Patient ID</p>
                    <p className="text-textDark">{claim.memberId}</p> {/* Changed from patient_id to memberId */}
                  </div>
                  <div>
                    <p className="text-textDark/60 text-xs uppercase tracking-wider font-medium">Date of Birth</p>
                    <p className="text-textDark">{formatDate(claim.dateOfBirth)}</p> {/* Changed from dos to dateOfBirth */}
                  </div>
                </div>
                  <div>
                  <div className="mb-2">
                    <p className="text-textDark/60 text-xs uppercase tracking-wider font-medium">Billing ID</p>
                    <p className="text-textDark">{claim.billing_id || claim.claimId || 'N/A'}</p> {/* Updated to use billing_id or fallback to claimId */}
                  </div>
                  <div>
                    <p className="text-textDark/60 text-xs uppercase tracking-wider font-medium">Date of Service</p>
                    <p className="text-textDark">{formatDate(claim.dos)}</p> {/* Changed from service_end to dos */}
                  </div>
                </div>
                
                <div>
                  <div className="mb-2">
                    <p className="text-textDark/60 text-xs uppercase tracking-wider font-medium">CPT Code</p>
                    <p className="text-pink font-medium">{claim.cptCodes && claim.cptCodes.length > 0 ? claim.cptCodes.join(', ') : 'N/A'}</p> {/* Changed to use pink color */}
                  </div>
                  <div>
                    <p className="text-textDark/60 text-xs uppercase tracking-wider font-medium">Claim Status</p>
                    <span className={`inline-block px-2 py-0.5 rounded text-sm ${getStatusDisplayStyle(claim.status)}`}> {/* Changed from claim_status to status */}
                      {claim.status || 'Not Set'} {/* Changed from claim_status to status */}
                    </span>
                  </div>
                </div>
              </div>
                {/* View Details link */}
              <div className="text-right">
                <Link to={`/profile/${claim.id || claim.claimId || claim.billing_id}`} className="text-blue hover:text-blue/80 text-sm font-medium">
                  View Details
                </Link>
              </div>
            </div>
          </div>
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
