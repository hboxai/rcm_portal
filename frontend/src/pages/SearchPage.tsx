import React, { useEffect, useState } from 'react';
import Header from '../components/layout/Header';
import SearchForm from '../components/search/SearchForm';
import SearchResults from '../components/search/SearchResults';
import { useClaims } from '../contexts/ClaimContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { SearchFilters } from '../types/claim';

const SearchPage: React.FC = () => {
  const {
    searchResults,
    isLoading,
    searchClaims,
    error, // Changed from searchError to error to match context
    currentPage,
    totalPages,
    claimsPerPage,
    totalClaimCount,
    hasSearched,
    setHasSearched
  } = useClaims();
  
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({});
  const [filters, setFilters] = useState<SearchFilters>({});  useEffect(() => {
    console.log('SearchPage: Component mounted');
    console.log('SearchPage: Auth state -', { isAuthenticated, authLoading });
    
    if (!isAuthenticated && !authLoading) {
      console.log('SearchPage: Not authenticated, redirecting to login');
      navigate('/login');
    } else if (isAuthenticated) {
      console.log('SearchPage: Authentication confirmed, can load claims');
      // Verify token is still valid by checking for auth errors
      if (error && error.includes('Authentication required')) {
        console.log('SearchPage: Auth error detected, redirecting to login');
        navigate('/login');
      }
    }
  }, [isAuthenticated, authLoading, navigate, error]);

  const handleSearch = async (searchFilters: SearchFilters) => {
    setHasSearched(true);
    setCurrentFilters(searchFilters);
    await searchClaims({ ...searchFilters, page: 1, limit: claimsPerPage });
  };

  const handlePageChange = (newPage: number) => {
    // Always use the last search filters for pagination
    setHasSearched(true); // Ensure hasSearched stays true
    searchClaims({ ...currentFilters, page: newPage, limit: claimsPerPage });
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
    <div className="min-h-screen bg-gradient-to-br from-background-900 to-background-800 text-white">
      <Header />
      <div className="p-4 md:p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-accent-500 to-accent-300">
            Claim Search
          </h1>
          
          <SearchForm onSearch={handleSearch} isLoading={isLoading} filters={filters} setFilters={setFilters} />
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
          />
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
