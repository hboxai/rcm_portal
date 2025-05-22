import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, User, DollarSign, Shield } from 'lucide-react';
import Header from '../components/layout/Header';
import GlassCard from '../components/ui/GlassCard';
import { useClaims } from '../contexts/ClaimContext';
import { useAuth } from '../contexts/AuthContext';

const FullProfilePage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { id } = useParams<{ id: string }>();
  const { getClaim, currentClaim } = useClaims();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    if (id) {
      getClaim(id);
    }
  }, [id, getClaim, isAuthenticated, navigate]);

  if (!isAuthenticated || !currentClaim) return null;
  
  // Format value for display
  const formatValue = (value: any, label?: string): string => {
    // Explicitly handle null, undefined, and empty strings
    if (value === undefined || value === null || value === '') return 'N/A';
    
    // Format date strings to MM/DD/YYYY
    if (
      typeof value === 'string' && 
      (value.match(/^\d{4}-\d{2}-\d{2}/) || value.match(/^\d{4}\/\d{2}\/\d{2}/))
    ) {
      try {
        const date = new Date(value);
        // Check if date is valid before formatting
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        }
      } catch (e) {
        // If date parsing fails, return the original value
        return value;
      }
    }
    
    if (typeof value === 'number') {
      // For IDs and other number fields, return as-is without decimal formatting
      if (label && (
          label.toLowerCase() === 'id' || 
          label.toLowerCase().includes('patient id') || 
          label.toLowerCase().includes('billing id') || // Changed from 'cpt id'
          label.toLowerCase().includes('units')
        )) {
        return value.toString();
      }
      
      // Format currency amounts - check for money-related labels
      if (label && (
          label.toLowerCase().includes('amount') || 
          label.toLowerCase().includes('check') ||
          label.toLowerCase().includes('amt') ||
          label.toLowerCase().includes('bal')
        )) {
        return `$${value.toFixed(2)}`;
      }
      
      // Format percentages
      if (label && label.toLowerCase().includes('percentage')) {
        return `${value.toFixed(2)}%`;
      }
      
      return value.toString();
    }
    
    return String(value);
  };
  
  // Field display component
  const Field: React.FC<{ label: string; value: any }> = ({ label, value }) => (
    <div className="mb-4">
      <p className="text-white/60 text-sm mb-1">{label}</p>
      <p className="font-medium">{formatValue(value, label)}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-900 to-background-800 text-white">
      <Header />
      
      <div className="container mx-auto pt-24 pb-12 px-4 md:px-6">
        <div className="mb-8 p-6 rounded-xl bg-olive-green/80 backdrop-blur-sm border border-olive-green/40 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Link 
              to={`/profile/${id}`} 
              className="text-white hover:text-white/80 flex items-center gap-1 transition-colors"
            >
              <ChevronLeft size={18} />
              <span>Back to Profile</span>
            </Link>
          </div>
          
          <h1 className="text-3xl font-bold text-white">
            Full Profile: Billing ID {currentClaim.billing_id || currentClaim.claimId || 'N/A'}
          </h1>
          <p className="text-white/80 mt-2">
            Complete information for this claim
          </p>
        </div>
        
        {/* Patient Information Card */}
        <div className="mb-8">
          <GlassCard className="bg-olive-green/80 backdrop-blur-sm border border-olive-green/40 text-white">
            <div className="flex items-center gap-2 mb-6">
              <User className="text-earth-yellow" size={22} />
              <h2 className="text-xl font-semibold">Patient Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Field label="Patient ID" value={currentClaim.memberId} />
              <Field label="Billing ID" value={currentClaim.billing_id || currentClaim.claimId} />
              <Field label="Patient EMR No." value={currentClaim.memberId} />
              <Field label="First Name" value={currentClaim.patientName?.split(' ')[0]} />
              <Field label="Last Name" value={currentClaim.patientName?.split(' ').slice(1).join(' ')} />
              <Field label="Date of Birth" value={currentClaim.dos} />
              <Field label="CPT Code" value={currentClaim.cptCodes?.join(', ')} />
              <Field label="ICD Code" value={currentClaim.icdCodes?.join(', ')} />
              <Field label="Provider Name" value={currentClaim.payer} />
              <Field label="Service Start" value={currentClaim.dos} />
              <Field label="Service End" value={currentClaim.dos} />
              <Field label="Units" value={undefined} />
            </div>
          </GlassCard>
        </div>
        
        {/* Claim & Billing Information Card */}
        <div className="mb-8">
          <GlassCard className="bg-olive-green/80 backdrop-blur-sm border border-olive-green/40 text-white">
            <div className="flex items-center gap-2 mb-6">
              <DollarSign className="text-earth-yellow" size={22} />
              <h2 className="text-xl font-semibold">Claim & Billing Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Field label="OA Claim ID" value={currentClaim.claimId} />
              <Field label="OA Visit ID" value={currentClaim.id} />
              <Field label="Charge Date" value={currentClaim.dos} />
              <Field label="Charge Amount" value={currentClaim.billedAmount} />
              <Field label="Allowed Amount" value={currentClaim.paidAmount} />
              <Field label="Allowed Add Amount" value={undefined} />
              <Field label="Allowed Exp Amount" value={undefined} />
              <Field label="Total Amount" value={currentClaim.billedAmount} />
              <Field label="Charges Adj Amount" value={undefined} />
              <Field label="Write Off Amount" value={undefined} />
              <Field label="Balance Amount" value={currentClaim.billedAmount - (currentClaim.paidAmount || 0)} />
              <Field label="Reimbursement Percentage" value={undefined} />
              <Field label="Claim Status" value={currentClaim.status} />
              <Field label="Claim Status Type" value={undefined} />
            </div>
          </GlassCard>
        </div>
        
        {/* Insurance Information Card */}
        <div>
          <GlassCard className="bg-olive-green/80 backdrop-blur-sm border border-olive-green/40 text-white">
            <div className="flex items-center gap-2 mb-6">
              <Shield className="text-earth-yellow" size={22} />
              <h2 className="text-xl font-semibold">Insurance Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Primary Insurance */}
              <div className="md:col-span-3 mt-2 mb-4">
                <h3 className="text-lg font-medium text-white/90 border-b border-white/10 pb-2 mb-4">Primary Insurance</h3>
              </div>
              
              <Field label="Primary Insurance" value={currentClaim.payer} />
              <Field label="Primary Amount" value={currentClaim.paidAmount} />
              <Field label="Primary Post Date" value={currentClaim.updatedAt} />
              <Field label="Primary Check Details" value={undefined} />
              <Field label="Primary Received Date" value={currentClaim.updatedAt} />
              <Field label="Primary Check Amount" value={currentClaim.paidAmount} />
              <div className="md:col-span-3">
                <Field label="Primary Comment" value={currentClaim.notes?.join(', ')} />
              </div>
              
              {/* Secondary Insurance */}
              <div className="md:col-span-3 mt-4 mb-4">
                <h3 className="text-lg font-medium text-white/90 border-b border-white/10 pb-2 mb-4">Secondary Insurance</h3>
              </div>
              
              <Field label="Secondary Insurance" value={undefined} />
              <Field label="Secondary Amount" value={undefined} />
              <Field label="Secondary Post Date" value={undefined} />
              <Field label="Secondary Check Details" value={undefined} />
              <Field label="Secondary Received Date" value={undefined} />
              <Field label="Secondary Check Amount" value={undefined} />
              <div className="md:col-span-3">
                <Field label="Secondary Comment" value={undefined} />
              </div>
              
              {/* Patient Payment */}
              <div className="md:col-span-3 mt-4 mb-4">
                <h3 className="text-lg font-medium text-white/90 border-b border-white/10 pb-2 mb-4">Patient Payment</h3>
              </div>
              
              <Field label="Patient Amount" value={undefined} />
              <Field label="Patient Received Date" value={undefined} />
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default FullProfilePage;