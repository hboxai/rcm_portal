import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, FileText } from 'lucide-react';
import Header from '../components/layout/Header';
import SummaryCard from '../components/profile/SummaryCard';
import ClaimTabs from '../components/profile/ClaimTabs';
import HistorySection from '../components/profile/HistorySection';
import Button from '../components/ui/Button';
import { useClaims } from '../contexts/ClaimContext';
import { useAuth } from '../contexts/AuthContext';

const ProfilePage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { id } = useParams<{ id: string }>();
  const { getClaim, currentClaim, isLoading } = useClaims();
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false); // State to toggle expanded view

  // Always fetch claim on mount or when id changes
  useEffect(() => {
    if (id) {
      getClaim(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleViewFullProfile = () => {
    navigate(`/full-profile/${id}`);
  };

  // Toggle details view
  const toggleDetails = () => {
    setShowDetails(prev => !prev);
  };

  // Format date safely
  const formatDate = (dateString?: string | null): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  if (!isAuthenticated || isLoading) return <div className="text-center text-white py-12">Loading claim details...</div>;
  if (!currentClaim) return <div className="text-center text-red-400 py-12">Claim not found.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-900 to-background-800 text-white">
      <Header />
      
      <div className="container mx-auto pt-24 pb-12 px-4 md:px-6">
        {/* Light header to match search page */}
        <div className="mb-8 p-6 rounded-xl bg-olive-green/80 backdrop-blur-sm border border-olive-green/40 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Link 
              to="/search" 
              className="text-white hover:text-white/80 flex items-center gap-1"
            >
              <ChevronLeft size={18} />
              <span>Back to Search</span>
            </Link>
          </div>
          
          <h1 className="text-3xl font-bold text-white">
            Billing ID: {currentClaim.billing_id || currentClaim.claimId || 'N/A'}
          </h1>
          <p className="text-white/80 mt-2">
            Patient: {currentClaim.patientName || 'N/A'} | 
            DOS: {formatDate(currentClaim.dos)}
          </p>
        </div>
        
        <SummaryCard claim={currentClaim} onToggleDetails={toggleDetails} isExpanded={showDetails} />
        
        {/* Show ClaimTabs instantly without animation */}
        {showDetails && (
          <div className="pt-6 mt-6">
            <ClaimTabs claim={currentClaim} />
          </div>
        )}
        
        {/* History Section */}
        <HistorySection claimId={currentClaim.id || currentClaim.claimId} />
        
        {/* View Full Profile Button with orange color */}
        <div className="mt-8 flex justify-center">
          <Button 
            variant="secondary" 
            className="text-olive-green bg-earth-yellow hover:bg-earth-yellow/80 px-4 py-2 rounded-md border border-earth-yellow/40 shadow-sm"
            icon={<FileText size={18} />}
            onClick={handleViewFullProfile}
          >
            View Full Profile
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
