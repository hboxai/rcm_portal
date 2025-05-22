import React, { memo, useEffect, useState } from 'react'; // Removed useMemo
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Eye, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { VisitClaim } from '../../types/claim';
import { useClaims } from '../../contexts/ClaimContext'; // Corrected to useClaims
import GlassCard from '../ui/GlassCard';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { ArrowRight } from 'lucide-react';

const tableVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const rowVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  },
  hover: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    transition: { duration: 0.2 }
  }
};

const RecentClaims: React.FC = () => {
  const { searchClaims, loading, error, totalClaimCount } = useClaims(); // Corrected to useClaims
  const [recentClaims, setRecentClaims] = useState<VisitClaim[]>([]);

  useEffect(() => {
    const fetchRecentClaims = async () => {
      try {
        // Fetch top 5 recent claims, sorted by date of service or creation if possible
        // For now, just fetching page 1 with a limit of 5
        const response = await searchClaims({}, 1, 5);
        if (response && response.claims) {
          setRecentClaims(response.claims);
        }
      } catch (err) {
        console.error("Failed to fetch recent claims:", err);
        // Error state is handled by the context's error property, or you can add local error handling
      }
    };

    fetchRecentClaims();
  }, [searchClaims]);

  if (loading && recentClaims.length === 0) { // Show loading only if there are no claims yet
    return (
      <GlassCard className="p-6 min-h-[200px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-400" />
      </GlassCard>
    );
  }

  if (error) {
    return <div className="text-center p-4 text-red-500">Error loading recent claims: {error}</div>;
  }

  if (recentClaims.length === 0) {
    return (
      <GlassCard className="p-6 min-h-[200px]">
        <h3 className="text-xl font-semibold text-white mb-4">Recent Claims</h3>
        <p className="text-white/70">No recent claims found.</p>
      </GlassCard>
    );
  }

  const recentClaimsToDisplay = recentClaims.slice(0, 5);

  return (
    <GlassCard className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-white">Recent Claims</h3>
        {totalClaimCount > 5 && ( // Show "View All" if there are more claims than displayed
          <Button variant="link" asChild className="text-blue-600 hover:text-blue-800">
            <Link to="/search">
              View All 
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <AnimatePresence>
          {recentClaimsToDisplay.length > 0 ? (
            <motion.table 
              className="min-w-full divide-y divide-olive-green/20"
              variants={tableVariants}
              initial="hidden"
              animate="visible"
            >
              <thead className="text-textDark/70">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider">
                    DOS
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-olive-green/20">
                {recentClaimsToDisplay.map((claim: VisitClaim, index: number) => ( // Added types
                  <motion.tr 
                    key={claim.id || index}
                    variants={rowVariants}
                    whileHover="hover"
                    custom={index}
                    layoutId={`claim-row-${claim.id}`}
                  >
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-textDark">
                      <Link to={`/profile/${claim.id}`} className="hover:underline text-blue-600">
                        {claim.patientName}
                      </Link>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-textDark">
                      {claim.dos ? new Date(claim.dos).toLocaleDateString() : 'N/A' /* Basic date formatting */}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <Badge variant={claim.status === 'Paid' ? 'default' : claim.status === 'Pending' ? 'secondary' : 'destructive'}>
                        {claim.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right">
                      ${(claim.billedAmount?.toFixed(2) || '0.00')}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </motion.table>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-textDark/60"
            >
              No recent claims found.
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassCard>
  );
};

// Use memo to prevent unnecessary re-renders
export default memo(RecentClaims);
