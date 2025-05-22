import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  History, 
  User, 
  Clock, 
  FilterX, 
  Filter, 
  FileSearch
} from 'lucide-react';
import Header from '../components/layout/Header';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';
import GlassInput from '../components/ui/GlassInput';
import { useAuth } from '../contexts/AuthContext';
import { ChangeLog, HistoryFilters, PaginatedHistoryResponse } from '../types/claim';
import { fetchAllHistory } from '../services/claimService';

// Cache for history data
const historyPageCache: Record<string, {
  data: any;
  timestamp: number;
  filters: HistoryFilters;
  page: number;
}> = {};

// Cache expiration time (2 minutes)
const HISTORY_PAGE_CACHE_EXPIRY = 2 * 60 * 1000;

const HistoryPage: React.FC = () => {
  const { isAdmin, user } = useAuth(); // Added user here
  const [history, setHistory] = useState<ChangeLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalPages: 1,
    totalCount: 0
  });
  
  // Add state for tracking the last fetch time
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  
  // Use a ref to track if the component is mounted
  const isMounted = useRef(true);
  
  // Filter states
  const [filters, setFilters] = useState<HistoryFilters>({
    user_name: undefined,
    username: undefined,
    cpt_id: undefined, // Changed from billing_id to cpt_id
    start_date: undefined,
    end_date: undefined
  });
  
  // Generate a cache key based on filters and page
  const getCacheKey = useCallback(() => {
    const filterKeys = Object.entries(filters)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${key}:${value}`)
      .join(',');
    
    return `page:${pagination.page},limit:${pagination.limit},${filterKeys}`;
  }, [filters, pagination.page, pagination.limit]);
  
  // Optimized load history function
  const loadHistory = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    const cacheKey = getCacheKey();
    
    if (!forceRefresh && 
        historyPageCache[cacheKey] && 
        now - historyPageCache[cacheKey].timestamp < HISTORY_PAGE_CACHE_EXPIRY) {
      console.log(`Using cached history page data for key ${cacheKey}`);
      setHistory(historyPageCache[cacheKey].data.data);
      setPagination(prev => ({
        ...prev,
        totalPages: historyPageCache[cacheKey].data.totalPages,
        totalCount: historyPageCache[cacheKey].data.totalCount
      }));
      return;
    }
    
    if (!forceRefresh && now - lastFetchTime < 2000) {
      console.log('Skipping history page fetch - throttled');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setLastFetchTime(now);

    let currentFilters = { ...filters };
    if (!isAdmin && user?.username) {
      currentFilters.user_name = user.username;
    }
    // If admin is filtering by a specific user, that will be in filters.user_name
    // If not admin, their own username is now set in currentFilters.user_name
    // If admin and not filtering by user_name, then user_name remains undefined, and all logs are fetched.
    
    try {
      const response = await fetchAllHistory({
        ...currentFilters, // Use modified filters
        page: pagination.page,
        limit: pagination.limit
      });
      
      // Check if component is still mounted
      if (!isMounted.current) return;
      
      if (response.success) {
        const paginatedResponse = response as PaginatedHistoryResponse;
        setHistory(paginatedResponse.data);
        setPagination(prev => ({
          ...prev,
          totalPages: paginatedResponse.totalPages,
          totalCount: paginatedResponse.totalCount
        }));
        
        // Cache the result
        historyPageCache[cacheKey] = {
          data: paginatedResponse,
          timestamp: now,
          filters: {...filters},
          page: pagination.page
        };
      } else {
        // Handling different error scenarios with user-friendly messages
        if (response.message?.includes('status code 500')) {
          setError('Unable to load history data right now. Please try again later.');
        } else if (response.message?.includes('Network Error')) {
          setError('Network error. Please check your connection and try again.');
        } else {
          // Don't show an error for empty results
          console.log('API response indicates no history data available');
        }
        setHistory([]);
      }
    } catch (err) {
      // Check if component is still mounted
      if (!isMounted.current) return;
      
      console.error('Error loading history:', err);
      setError('An error occurred while loading history data. Please try again later.');
      setHistory([]);
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [filters, pagination.page, pagination.limit, lastFetchTime, getCacheKey]);
  
  // Effect to load data when pagination or filters change
  useEffect(() => {
    loadHistory(false);
  }, [pagination.page, filters, loadHistory]);
  
  // Set isMounted to true when component mounts and false when unmounts
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const clearFilters = () => {
    setFilters({
      user_name: undefined,
      username: undefined,
      cpt_id: undefined,
      start_date: undefined,
      end_date: undefined
    });
  };
  
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({
        ...prev,
        page: newPage
      }));
    }
  };
  
  // Helper function to format field names for display
  const formatFieldName = (fieldName: string): string => {
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Helper function to format date/time in IST
  const formatDateTimeIST = (dateTime: string): string => {
    try {
      const date = new Date(dateTime);
      // Convert to IST (UTC+5:30)
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      };
      return new Intl.DateTimeFormat('en-IN', options).format(date);
    } catch (err) {
      return dateTime;
    }
  };
  
  const toggleFilters = () => {
    setShowFilters(prev => !prev);
  };
  
  // Generate page numbers for pagination
  const pageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, pagination.page - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(pagination.totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  };
  
  // Helper to create a simple from/to change description
  const getChangeDescription = (log: ChangeLog): string => {
    const oldVal = log.old_value || 'None';
    const newVal = log.new_value || 'None';
    return `${oldVal} → ${newVal}`;
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background-900 to-background-800 text-white">
      <Header />
      
      <div className="container mx-auto pt-24 pb-12 px-4 md:px-6">
        <div
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Link 
                to="/" 
                className="text-black hover:text-gray-700 flex items-center gap-1" // Changed text-white to text-black and hover:text-gray-300 to hover:text-gray-700
              >
                <ChevronLeft size={18} />
                <span>Back to Dashboard</span>
              </Link>
            </div>
            
            <Button
              variant="secondary"
              onClick={toggleFilters}
              icon={showFilters ? <FilterX size={16} /> : <Filter size={16} />}
              className="text-black" // Added text-black
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </Button>
          </div>
          
          <h1 className="text-3xl font-bold text-black flex items-center gap-3"> {/* Changed text-white to text-black */}
            <History className="text-accent-400" size={28} />
            Change History
          </h1>
          <p className="text-black mt-2"> {/* Changed text-white to text-black */}
            {isAdmin 
              ? 'View all changes made to claims by all users'
              : 'View changes you have made to claims'}
          </p>
        </div>
        
        {/* Filters Section */}
        {showFilters && (
          <div
            className="mb-6"
          >
            <GlassCard className="bg-olive-green/80 text-white">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
                  <Filter size={18} className="text-accent-400" />
                  Filter History
                </h2>
                <Button
                  variant="secondary"
                  onClick={clearFilters}
                  icon={<FilterX size={14} />}
                >
                  Clear Filters
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {isAdmin && (
                  <>
                    <GlassInput
                      label="User Name"
                      name="user_name"
                      type="text"
                      value={filters.user_name || ''}
                      onChange={handleFilterChange}
                      placeholder="Filter by user name"
                      icon={<User size={16} />}
                      labelClassName="text-white/80" // Added
                      inputClassName="text-white" // Added
                    />
                  </>
                )}
                
                <GlassInput
                  label="Billing ID"
                  name="cpt_id"
                  type="text"
                  value={filters.cpt_id || ''}
                  onChange={handleFilterChange}
                  placeholder="Filter by Billing ID"
                  icon={<FileSearch size={16} />}
                  labelClassName="text-white/80"
                  inputClassName="text-white"
                />
                
                <GlassInput
                  label="Start Date"
                  name="start_date"
                  type="date"
                  value={filters.start_date || ''}
                  onChange={handleFilterChange}
                  placeholder="Filter by start date"
                  icon={<Calendar size={16} />}
                  labelClassName="text-white/80" // Added
                  inputClassName="text-white" // Added
                />
                
                <GlassInput
                  label="End Date"
                  name="end_date"
                  type="date"
                  value={filters.end_date || ''}
                  onChange={handleFilterChange}
                  placeholder="Filter by end date"
                  icon={<Calendar size={16} />}
                  labelClassName="text-white/80" // Added
                  inputClassName="text-white" // Added
                />
              </div>
              
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={() => {
                    setPagination(prev => ({ ...prev, page: 1 }));
                    loadHistory();
                  }}
                >
                  Apply Filters
                </Button>
              </div>
            </GlassCard>
          </div>
        )}
        
        {/* History Content */}
        <div
        >
          <GlassCard className="bg-olive-green/80 text-white">
            {isLoading ? (
              <div className="flex justify-center items-center py-20">
                <div className="w-12 h-12 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="ml-4 text-xl text-white/70">Loading history...</p>
              </div>
            ) : error ? (
              <div className="bg-error-900/30 text-error-400 p-6 rounded-md text-center">
                <p className="text-lg">{error}</p>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-20 text-white/60">
                <History size={48} className="mx-auto mb-4 text-white/30" />
                <h3 className="text-2xl font-medium mb-2">No history found</h3>
                <p>No change history records match your current filters.</p>
              </div>
            ) : (
              <>
                <div className="mb-4 text-white/70 text-right">
                  Showing {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of {pagination.totalCount} records
                </div>
              
                <div className="space-y-4">
                  {history.map((log) => (
                    <div key={log.id} className="bg-dark-olive-green/50 rounded-md p-4 text-white hover:bg-dark-olive-green/70 transition-colors border border-white/5">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="bg-accent-500/20 p-2 rounded-full">
                            <User size={16} className="text-accent-400" />
                          </div>
                          <span className="font-medium text-white">{log.username}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/profile/${log.cpt_id}`}
                            className="text-accent-400 hover:text-accent-300 transition-colors flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full"
                          >
                            <FileSearch size={14} />
                            <span>View Claim</span>
                          </Link>
                          
                          <div className="bg-white/10 px-3 py-1 rounded-full text-white/90 flex items-center gap-1">
                            <span className="text-white/70">Billing ID:</span>
                            <span>{log.cpt_id ? log.cpt_id : 'Pending Assignment'}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-white/80 bg-white/5 px-3 py-1 rounded-full">
                          <Clock size={14} />
                          <span>{formatDateTimeIST(log.timestamp)}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col p-3 bg-white/5 rounded-md mt-2 border-l-2 border-accent-400">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-white/60">Modified:</span>
                          <span className="font-medium text-white bg-white/10 px-2 py-0.5 rounded">
                            {formatFieldName(log.field_name)}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                          <div className="flex flex-col">
                            <span className="text-xs text-white/60">Previous value:</span>
                            <div 
                              className="text-white font-medium bg-white/5 p-2 rounded mt-1 break-words relative group cursor-help"
                              title={log.old_value || 'None'}
                            >
                              <span className="line-clamp-3">{log.old_value || 'None'}</span>
                              
                              {/* Hover tooltip for longer text */}
                              {log.old_value && log.old_value.length > 100 && (
                                <div className="absolute left-0 top-full mt-2 z-10 bg-dark-olive-green p-4 rounded-md shadow-lg 
                                  max-w-md w-max max-h-60 overflow-auto invisible group-hover:visible opacity-0 group-hover:opacity-100 
                                  transition-opacity duration-200 border border-white/20">
                                  {log.old_value}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-col">
                            <span className="text-xs text-white/60">New value:</span>
                            <div 
                              className="text-white font-medium bg-accent-500/10 p-2 rounded mt-1 break-words relative group cursor-help"
                              title={log.new_value || 'None'}
                            >
                              <span className="line-clamp-3">{log.new_value || 'None'}</span>
                              
                              {/* Hover tooltip for longer text */}
                              {log.new_value && log.new_value.length > 100 && (
                                <div className="absolute left-0 top-full mt-2 z-10 bg-dark-olive-green p-4 rounded-md shadow-lg 
                                  max-w-md w-max max-h-60 overflow-auto invisible group-hover:visible opacity-0 group-hover:opacity-100 
                                  transition-opacity duration-200 border border-white/20">
                                  {log.new_value}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3 text-xs text-white/50 italic">
                        Log ID: {log.id}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="mt-6 flex justify-center">
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handlePageChange(1)}
                        disabled={pagination.page === 1}
                        className={`p-2 rounded-md ${
                          pagination.page === 1 
                            ? 'text-white/30 cursor-not-allowed' 
                            : 'text-white/70 hover:bg-white/10'
                        }`}
                      >
                        First
                      </button>
                      
                      <button
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page === 1}
                        className={`p-2 rounded-md ${
                          pagination.page === 1 
                            ? 'text-white/30 cursor-not-allowed' 
                            : 'text-white/70 hover:bg-white/10'
                        }`}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      
                      {pageNumbers().map(number => (
                        <button
                          key={number}
                          onClick={() => handlePageChange(number)}
                          className={`w-10 h-10 flex items-center justify-center rounded-md ${
                            pagination.page === number 
                              ? 'bg-accent-500/20 text-accent-400' 
                              : 'text-white/70 hover:bg-white/10'
                          }`}
                        >
                          {number}
                        </button>
                      ))}
                      
                      <button
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page === pagination.totalPages}
                        className={`p-2 rounded-md ${
                          pagination.page === pagination.totalPages 
                            ? 'text-white/30 cursor-not-allowed' 
                            : 'text-white/70 hover:bg-white/10'
                        }`}
                      >
                        <ChevronRight size={18} />
                      </button>
                      
                      <button
                        onClick={() => handlePageChange(pagination.totalPages)}
                        disabled={pagination.page === pagination.totalPages}
                        className={`p-2 rounded-md ${
                          pagination.page === pagination.totalPages 
                            ? 'text-white/30 cursor-not-allowed' 
                            : 'text-white/70 hover:bg-white/10'
                        }`}
                      >
                        Last
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;