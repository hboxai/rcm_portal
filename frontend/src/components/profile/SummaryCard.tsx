import React, { useState, useEffect, useCallback, memo } from 'react';
import { CheckCircle, Edit2, Lock, ChevronUp, Calendar, User, Clock, Tag, Eye, FileText, DollarSign, Clipboard, Activity } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import Button from '../ui/Button';
import ClaimField, { formatters } from '../ui/ClaimField';
import { VisitClaim } from '../../types/claim';
import { useClaims } from '../../contexts/ClaimContext';

interface SummaryCardProps {
  claim: VisitClaim;
  onToggleDetails: () => void;
  isExpanded: boolean;
}

const claimStatusOptions = [
  'Claim not filed',
  'Claim not received from HBox',
  'Deductible Applied',
  'High Copay Writeoff',
  'Inpatient for DOS',
  'Insurance Paid',
  'Multiple Provider enrollment',
  'No Sec Ins',
  'Patient Deceased',
  'Policy Inactive',
  'Prim Denied',
  'Prim Pymt Pending',
  'Program not covered',
  'Sec Denied. Prim Paid more than Allowed amt',
  'Sec not paying',
  'Sec Pymt Pending'
];

const SummaryCard: React.FC<SummaryCardProps> = ({ claim, onToggleDetails, isExpanded }) => {
  const { updateClaim } = useClaims();
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isEditable, setIsEditable] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [hasBeenEdited, setHasBeenEdited] = useState(false);

  // Set initial status from claim with useEffect cleanup
  useEffect(() => {
    setSelectedStatus(claim.claim_status || '');
    
    // If the claim has a status already and hasn't been edited in this session,
    // set it as non-editable by default
    if (claim.claim_status && !hasBeenEdited) {
      setIsEditable(false);
    }
    
    return () => {
      // Cleanup function to avoid memory leaks with any potential timeouts
      if (showConfirmation) {
        setShowConfirmation(false);
      }
    };
  }, [claim.claim_status, hasBeenEdited, showConfirmation]);

  const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStatus(e.target.value);
  }, []);

  const handleSaveStatus = useCallback(() => {
    if (selectedStatus) {
      // Show immediate visual feedback
      const saveButton = document.querySelector('button[data-save-status]');
      if (saveButton) {
        (saveButton as HTMLButtonElement).disabled = true;
        (saveButton as HTMLButtonElement).innerHTML = 'Saving...';
      }
      
      // Make sure we include all required fields for a status update
      updateClaim({
        id: claim.id,
        claim_status: selectedStatus,
        claim_status_type: claim.claim_status_type, // Ensure we preserve the existing status type
        // Update the legacy status field for compatibility
        status: (selectedStatus === 'Posted' || selectedStatus === 'Pending' || selectedStatus === 'Rejected') 
          ? selectedStatus as 'Posted' | 'Pending' | 'Rejected' 
          : 'Pending',
        updatedAt: new Date().toISOString(),
      })
      .then((result) => {
        console.log('Status update result:', result);
        
        // After saving, make the status non-editable
        setIsEditable(false);
        setHasBeenEdited(true);
        setShowConfirmation(true);
        
        // Hide confirmation message after 3 seconds
        setTimeout(() => {
          setShowConfirmation(false);
        }, 3000);
        
        // Re-enable button
        if (saveButton) {
          (saveButton as HTMLButtonElement).disabled = false;
          (saveButton as HTMLButtonElement).innerHTML = 'Save';
        }
      })
      .catch((error) => {
        console.error('Error updating status:', error);
        
        // Show error with alert since we don't have a dedicated error UI here
        alert('Failed to save status. Please try again.');
        
        // Re-enable button
        if (saveButton) {
          (saveButton as HTMLButtonElement).disabled = false;
          (saveButton as HTMLButtonElement).innerHTML = 'Save';
        }
      });
    }
  }, [selectedStatus, claim.id, claim.claim_status_type, updateClaim]);
  
  // Function to toggle edit mode (can only be done once)
  const toggleEditMode = useCallback(() => {
    if (!isEditable) {
      setIsEditable(true);
    }
  }, [isEditable]);

  // Determine status display style based on the selected status
  const getStatusDisplayStyle = useCallback((status: string) => {
    switch (status) {
      case 'Insurance Paid':
        return {
          className: 'bg-success-500/20 text-success-300 border border-success-500/30',
          icon: <CheckCircle size={16} className="text-success-400" />
        };
      case 'Claim not filed':
        return {
          className: 'bg-warning-500/20 text-warning-300 border border-warning-500/30',
          icon: <FileText size={16} className="text-warning-400" />
        };
      case 'Prim Denied':
      case 'Sec Denied. Prim Paid more than Allowed amt':
      case 'Patient Deceased':
        return {
          className: 'bg-error-500/20 text-error-300 border border-error-500/30',
          icon: <Tag size={16} className="text-error-400" />
        };
      case 'Prim Pymt Pending':
      case 'Sec Pymt Pending':
      case 'Claim not received from HBox':
        return {
          className: 'bg-warning-500/20 text-warning-300 border border-warning-500/30',
          icon: <Clock size={16} className="text-warning-400" />
        };
      default:
        return {
          className: 'bg-info-500/20 text-info-300 border border-info-500/30',
          icon: <FileText size={16} className="text-info-400" />
        };
    }
  }, []);

  // Fast click handler for view details button
  const handleViewDetailsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Call the toggle function immediately
    onToggleDetails();
  };

  return (
    <div className="mb-6">
      <GlassCard 
        className={`overflow-hidden bg-olive-green/80 backdrop-blur-sm border border-olive-green/40 text-white ${
          isExpanded 
            ? 'border-earth-yellow/50 shadow-lg' 
            : ''
        }`}
      >
        {/* Card Header */}
        <div className={`flex justify-between items-center mb-6 pb-3 ${isExpanded ? 'border-b border-white/10' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-earth-yellow/20 flex items-center justify-center">
              <FileText className="text-earth-yellow" size={20} />
            </div>
            <h2 className="text-xl font-semibold text-white">
              Claim Summary
            </h2>
          </div>
        </div>
        
        {/* Card Body - Improved Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Patient Information */}
          <div className="bg-dark-olive-green/30 p-4 rounded-lg border border-white/5">
            <h3 className="text-md font-medium text-white mb-3 flex items-center gap-2">
              <User className="text-earth-yellow" size={16} />
              Patient Information
            </h3>
            <div className="space-y-4">
              <ClaimField 
                label="Patient Name" 
                value={claim.patient_name || `${claim.first_name || ''} ${claim.last_name || ''}`}
                labelClassName="text-white/70 text-xs"
                valueClassName="text-white font-medium"
              />
              <ClaimField 
                label="Patient ID" 
                value={claim.patient_id}
                labelClassName="text-white/70 text-xs"
                valueClassName="text-white font-medium font-mono"
              />
              <ClaimField 
                label="Date of Birth" 
                value={claim.dateOfBirth || claim.date_of_birth} 
                formatter={formatters.date}
                labelClassName="text-white/70 text-xs"
                valueClassName="text-white font-medium"
              />
            </div>
          </div>
          
          {/* Claim Details */}
          <div className="bg-dark-olive-green/30 p-4 rounded-lg border border-white/5">
            <h3 className="text-md font-medium text-white mb-3 flex items-center gap-2">
              <Clipboard className="text-earth-yellow" size={16} />
              Claim Details
            </h3>
            <div className="space-y-4">
              <ClaimField 
                label="Billing ID" 
                value={claim.billing_id || claim.claimId}
                labelClassName="text-white/70 text-xs"
                valueClassName="text-white font-medium font-mono"
              />
              <ClaimField 
                label="CPT Code" 
                value={claim.cpt_code || (claim.cptCodes && claim.cptCodes.length > 0 ? claim.cptCodes.join(', ') : 'N/A')}
                labelClassName="text-white/70 text-xs"
                valueClassName="text-white font-medium font-mono"
              />
              <ClaimField 
                label="Date of Service" 
                value={claim.service_end || claim.dos} 
                formatter={formatters.date}
                labelClassName="text-white/70 text-xs"
                valueClassName="text-white font-medium"
              />
            </div>
          </div>
          
          {/* Financial Information */}
          <div className="bg-dark-olive-green/30 p-4 rounded-lg border border-white/5">
            <h3 className="text-md font-medium text-white mb-3 flex items-center gap-2">
              <DollarSign className="text-earth-yellow" size={16} />
              Financial Information
            </h3>
            <div className="space-y-4">
              <ClaimField 
                label="Payer Name" 
                value={claim.payer_name || claim.payerName || 'N/A'}
                labelClassName="text-white/70 text-xs"
                valueClassName="text-white font-medium"
              />
              <ClaimField 
                label="Amount" 
                value={claim.amount || claim.totalCharge || 'N/A'} 
                formatter={formatters.currency}
                labelClassName="text-white/70 text-xs"
                valueClassName="text-white font-medium"
              />
              <ClaimField 
                label="Amount Paid" 
                value={claim.amount_paid || claim.paidAmount || 'N/A'} 
                formatter={formatters.currency}
                labelClassName="text-white/70 text-xs"
                valueClassName="text-white font-medium"
              />
            </div>
          </div>
        </div>
        
        {/* Status Section */}
        <div className="bg-dark-olive-green/30 p-4 rounded-lg border border-white/5 mb-4">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Activity className="text-earth-yellow" size={16} />
              <h3 className="text-md font-medium text-white">Claim Status</h3>
            </div>
            
            {!isEditable && selectedStatus && (
              <button 
                onClick={toggleEditMode} 
                className="flex items-center gap-1 text-earth-yellow hover:text-earth-yellow/80 text-sm bg-white/5 px-3 py-1.5 rounded-full"
              >
                <Edit2 size={14} />
                <span>Edit Status</span>
              </button>
            )}
          </div>
          
          {isEditable ? (
            <div className="flex gap-3">
              <select
                className="glass-input flex-grow bg-dark-olive-green/50 text-white px-4 py-2.5 rounded-lg border border-white/20 focus:border-earth-yellow outline-none"
                value={selectedStatus || ''}
                onChange={handleStatusChange}
              >
                <option value="" className="bg-dark-olive-green text-white">Select a status</option>
                {claimStatusOptions.map(status => (
                  <option key={status} value={status} className="bg-dark-olive-green text-white">
                    {status}
                  </option>
                ))}
              </select>
              <Button 
                variant="primary" 
                onClick={handleSaveStatus}
                disabled={!selectedStatus}
                className="px-6 bg-earth-yellow hover:bg-earth-yellow/80 text-olive-green"
                data-save-status
              >
                Save
              </Button>
            </div>
          ) : (
            <div className="flex items-center flex-wrap gap-3">
              {selectedStatus ? (
                <div 
                  className={`px-4 py-2.5 rounded-lg flex items-center gap-2 ${getStatusDisplayStyle(selectedStatus).className}`}
                >
                  <div>
                    {getStatusDisplayStyle(selectedStatus).icon}
                  </div>
                  <span className="font-medium">{selectedStatus}</span>
                </div>
              ) : (
                <span className="bg-gray-600/30 text-white/70 px-4 py-2.5 rounded-lg">
                  No status set
                </span>
              )}
              
              {!isEditable && selectedStatus && (
                <span className="flex items-center gap-1 text-white/50 text-sm bg-white/5 px-3 py-1.5 rounded-full">
                  <Lock size={14} />
                  <span>Locked</span>
                </span>
              )}
            </div>
          )}
          
          {/* Success confirmation message */}
          {showConfirmation && (
            <div className="mt-3 flex items-center gap-2 text-success-400 bg-success-400/10 border border-success-500/20 px-4 py-2.5 rounded-lg">
              <CheckCircle size={18} />
              <span>Status saved successfully!</span>
            </div>
          )}
        </div>
        
        {/* Footer with button */}
        <div className="mt-5 flex justify-center">
          <Button
            variant="secondary"
            onClick={handleViewDetailsClick}
            className="px-6 py-2 bg-earth-yellow/20 hover:bg-earth-yellow/30 text-white border border-earth-yellow/30"
            icon={isExpanded ? <ChevronUp size={16} /> : <Eye size={16} />}
          >
            {isExpanded ? "Hide Details" : "View Details"}
          </Button>
        </div>
      </GlassCard>
    </div>
  );
};

// Use memo to prevent unnecessary re-renders
export default memo(SummaryCard);