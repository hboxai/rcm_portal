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

  useEffect(() => {
    setSelectedStatus(claim.status || '');
    if (claim.status && !hasBeenEdited) {
      setIsEditable(false);
    }
    return () => {
      if (showConfirmation) {
        setShowConfirmation(false);
      }
    };
  }, [claim.status, hasBeenEdited, showConfirmation]);

  const handleStatusChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStatus(e.target.value);
  }, []);

  const handleSaveStatus = useCallback(() => {
    if (selectedStatus) {
      const saveButton = document.querySelector('button[data-save-status]');
      if (saveButton) {
        (saveButton as HTMLButtonElement).disabled = true;
        (saveButton as HTMLButtonElement).innerHTML = 'Saving...';
      }
      updateClaim({
        id: claim.id,
        claim_status: selectedStatus, // <-- send claim_status, not status
        updatedAt: new Date().toISOString(),
      })
      .then((result) => {
        setIsEditable(false);
        setHasBeenEdited(true);
        setShowConfirmation(true);
        setTimeout(() => {
          setShowConfirmation(false);
        }, 3000);
        if (saveButton) {
          (saveButton as HTMLButtonElement).disabled = false;
          (saveButton as HTMLButtonElement).innerHTML = 'Save';
        }
      })
      .catch((error) => {
        alert('Failed to save status. Please try again.');
        if (saveButton) {
          (saveButton as HTMLButtonElement).disabled = false;
          (saveButton as HTMLButtonElement).innerHTML = 'Save';
        }
      });
    }
  }, [selectedStatus, claim.id, updateClaim]);

  const toggleEditMode = useCallback(() => {
    if (!isEditable) {
      setIsEditable(true);
    }
  }, [isEditable]);

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

  const handleViewDetailsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onToggleDetails();
  };

  return (
    <div className="mb-6">      <GlassCard 
        className={`overflow-hidden bg-white/95 backdrop-blur-sm border border-purple/20 text-textDark ${
          isExpanded 
            ? 'border-purple/50 shadow-lg' 
            : ''
        }`}
      >
        <div className={`flex justify-between items-center mb-6 pb-3 ${isExpanded ? 'border-b border-purple/10' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-pink/20 flex items-center justify-center">
              <FileText className="text-pink" size={20} />
            </div>
            <h2 className="text-xl font-semibold text-pink">
              Claim Summary
            </h2>
          </div>
        </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-light-100/50 p-4 rounded-lg border border-purple/10">
            <h3 className="text-md font-medium text-pink mb-3 flex items-center gap-2">
              <User className="text-pink" size={16} />
              Patient Information
            </h3>
            <div className="space-y-4">
              <ClaimField 
                label="Patient Name" 
                value={claim.patientName}
              />
              <ClaimField 
                label="Patient ID" 
                value={claim.memberId}
              />
              <ClaimField 
                label="Date of Birth" 
                value={claim.dateOfBirth}
                formatter={formatters.date}
              />
            </div>
          </div>
          
          <div className="bg-light-100/50 p-4 rounded-lg border border-purple/10">
            <h3 className="text-md font-medium text-pink mb-3 flex items-center gap-2">
              <Clipboard className="text-pink" size={16} />
              Claim Details
            </h3>
            <div className="space-y-4">
              <ClaimField 
                label="Billing ID" 
                value={claim.billing_id || claim.claimId}
              />
              <ClaimField 
                label="CPT Code" 
                value={claim.cptCodes && claim.cptCodes.length > 0 ? claim.cptCodes.join(', ') : 'N/A'}
              />
              <ClaimField 
                label="Date of Service" 
                value={claim.dos}
                formatter={formatters.date}
              />
            </div>
          </div>
          
          <div className="bg-light-100/50 p-4 rounded-lg border border-purple/10">            <h3 className="text-md font-medium text-pink mb-3 flex items-center gap-2">
              <DollarSign className="text-pink" size={16} />
              Financial Information
            </h3>
            <div className="space-y-4">
              <ClaimField 
                label="Payer Name" 
                value={claim.payer || 'N/A'}
              />
              <ClaimField 
                label="Amount" 
                value={claim.billedAmount}
                formatter={formatters.currency}
              />
              <ClaimField 
                label="Amount Paid" 
                value={claim.paidAmount}
                formatter={formatters.currency}
              />
            </div>
          </div>
        </div>
          <div className="bg-light-100/50 p-4 rounded-lg border border-purple/10 mb-4">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Activity className="text-pink" size={16} />
              <h3 className="text-md font-medium text-pink">Claim Status</h3>
            </div>
            
            {!isEditable && selectedStatus && (
              <button 
                onClick={toggleEditMode} 
                className="flex items-center gap-1 text-purple hover:text-purple/80 text-sm bg-purple/5 px-3 py-1.5 rounded-full"
              >
                <Edit2 size={14} />
                <span>Edit Status</span>
              </button>
            )}
          </div>
          
          {isEditable ? (
            <div className="flex gap-3">              <select
                className="glass-input flex-grow bg-white/70 text-textDark px-4 py-2.5 rounded-lg border border-purple/20 focus:border-purple outline-none"
                value={selectedStatus || ''}
                onChange={handleStatusChange}
              >
                <option value="" className="bg-white text-textDark">Select a status</option>
                {claimStatusOptions.map(status => (
                  <option key={status} value={status} className="bg-white text-textDark">
                    {status}
                  </option>
                ))}
              </select>
              <Button 
                variant="primary" 
                onClick={handleSaveStatus}
                disabled={!selectedStatus}
                className="px-6 bg-purple hover:bg-purple/90 text-white"
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
                </div>              ) : (
                <span className="bg-gray-500/20 text-textDark/70 px-4 py-2.5 rounded-lg">
                  No status set
                </span>
              )}
              
              {!isEditable && selectedStatus && (
                <span className="flex items-center gap-1 text-textDark/50 text-sm bg-purple/5 px-3 py-1.5 rounded-full">
                  <Lock size={14} />
                  <span>Locked</span>
                </span>
              )}
            </div>
          )}
          
          {showConfirmation && (
            <div className="mt-3 flex items-center gap-2 text-success-400 bg-success-400/10 border border-success-500/20 px-4 py-2.5 rounded-lg">
              <CheckCircle size={18} />
              <span>Status saved successfully!</span>
            </div>
          )}
        </div>
          <div className="mt-5 flex justify-center">
          <Button
            variant="secondary"
            onClick={handleViewDetailsClick}
            className="px-6 py-2 bg-purple/20 hover:bg-purple/30 text-purple border border-purple/30"
            icon={isExpanded ? <ChevronUp size={16} /> : <Eye size={16} />}
          >
            {isExpanded ? "Hide Details" : "View Details"}
          </Button>
        </div>
      </GlassCard>
    </div>
  );
};

export default memo(SummaryCard);