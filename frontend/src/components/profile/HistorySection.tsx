import React, { useState, useEffect, useRef, useCallback } from 'react';
import { History, ChevronDown, ChevronUp, User, Clock, RefreshCw } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import { ChangeLog } from '../../types/claim';
import { fetchClaimHistory } from '../../services/claimService';

interface HistorySectionProps {
  claimId: string | number;
}

// Cache to store history data by claimId
const historyCache: Record<string, {
  data: ChangeLog[];
  timestamp: number;
}> = {};

// Cache expiration time (5 minutes)
const CACHE_EXPIRY = 5 * 60 * 1000;

const HistorySection: React.FC<HistorySectionProps> = ({ claimId }) => {
  const [history, setHistory] = useState<ChangeLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false); // Changed to false so history is collapsed by default
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  
  // Use a ref to track if the component is mounted
  const isMounted = useRef(true);
  
  // Track if we've loaded data for this claimId
  const dataLoadedRef = useRef(false);

  // Memoized load history function to prevent unnecessary re-creation
  const loadHistory = useCallback(async (forceRefresh = false) => {
    const cacheKey = claimId.toString();
    const now = Date.now();
    
    // Check if we have fresh cached data and not forcing refresh
    if (!forceRefresh && 
        historyCache[cacheKey] && 
        now - historyCache[cacheKey].timestamp < CACHE_EXPIRY) {
      console.log(`Using cached history data for claim ${cacheKey}`);
      setHistory(historyCache[cacheKey].data);
      return;
    }
    
    // Don't fetch if we've fetched recently (within last 10 seconds) unless forced
    if (!forceRefresh && now - lastFetchTime < 10000) {
      console.log('Skipping history fetch - throttled');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setLastFetchTime(now);
    
    try {
      const response = await fetchClaimHistory(cacheKey);
      
      // Make sure component is still mounted before updating state
      if (!isMounted.current) return;
      
      if (response.success) {
        // Limit to 6 most recent entries
        setHistory(response.data.slice(0, 6));
        
        // Cache the result
        historyCache[cacheKey] = {
          data: response.data.slice(0, 6),
          timestamp: now
        };
        
        dataLoadedRef.current = true;
      } else {
        // Only set error for real API errors, not for empty datasets
        if (response.message?.includes('status code 500')) {
          setError('Unable to load history right now. Please try again later.');
        } else if (response.message?.includes('Network Error')) {
          setError('Network error. Please check your connection and try again.');
        } else {
          // Don't show error for empty datasets
          console.log('API response indicates no history data available');
        }
        setHistory([]);
      }
    } catch (err) {
      // Make sure component is still mounted before updating state
      if (!isMounted.current) return;
      
      console.error('Error loading history:', err);
      setError('An error occurred while loading history. Please try again later.');
      setHistory([]);
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [claimId]);

  // Set isMounted to true when the component mounts
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

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

      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return dateTime; // Return original string if invalid
      }

      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit', // Added seconds for more detail
        hour12: true
      };
      return new Intl.DateTimeFormat('en-IN', options).format(date);
    } catch (err) {
      return dateTime; // Fallback to original string on error
    }
  };
  
  // Helper to create a simple from/to change description
  const getChangeDescription = (log: ChangeLog): string => {
    const oldVal = log.old_value || 'None';
    const newVal = log.new_value || 'None';
    return `${oldVal} → ${newVal}`;
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    
    // Lazy-load history data when expanding if not already loaded
    if (!isExpanded && !dataLoadedRef.current) {
      loadHistory(false);
    }
  };

  // Handle manual refresh
  const handleRefresh = () => {
    loadHistory(true); // Force refresh
  };
  return (
    <div className="mt-6">
      <GlassCard className="bg-white/95 backdrop-blur-sm border border-purple/20">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <History className="text-pink" size={20} />
            <span className="text-pink">Change History</span>
          </h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleRefresh} 
              className="p-2 hover:bg-purple/10 rounded-full"
              disabled={isLoading}
              title="Refresh history"
            >
              <RefreshCw size={18} className={`text-purple/70 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={toggleExpand} 
              className="p-2 hover:bg-purple/10 rounded-full"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ChevronUp size={18} className="text-purple/70" /> : <ChevronDown size={18} className="text-purple/70" />}
            </button>
          </div>
        </div>
          {isExpanded && (
          <div className="mt-4">
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="w-8 h-8 border-2 border-purple border-t-transparent rounded-full animate-spin"></div>
                <p className="ml-3 text-textDark/70">Loading history...</p>
              </div>
            ) : error ? (
              <div className="bg-red/20 text-red p-4 rounded-md border border-red/30">
                <p>{error}</p>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-6 text-textDark/60">
                <History size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-lg font-medium mb-1">No History Available</p>
                <p>No changes have been recorded for this claim yet.</p>
                <button 
                  onClick={handleRefresh}
                  className="mt-4 text-blue hover:text-blue/80 flex items-center gap-2 mx-auto"
                >
                  <RefreshCw size={14} />
                  <span>Refresh</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((log) => (
                  <div key={log.id} className="bg-purple/5 border border-purple/20 rounded-md p-4">
                    <div className="flex flex-wrap items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-pink" />
                        <span className="font-medium text-textDark">{log.username}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-textDark/70" />
                        <span className="text-textDark/70">{formatDateTimeIST(log.timestamp)}</span>
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      <span className="text-textDark/60">Modified:</span>{' '}
                      <span className="font-medium">{formatFieldName(log.field_name)}</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-textDark/60">Change:</span>{' '}
                      <span className="font-medium">{getChangeDescription(log)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  );
};

export default HistorySection;