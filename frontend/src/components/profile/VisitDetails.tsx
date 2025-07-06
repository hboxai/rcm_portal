import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Save, X, FileText, UserCheck, Calendar, DollarSign } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import GlassInput from '../ui/GlassInput';
import GlassDatePicker from '../ui/GlassDatePicker';
import Button from '../ui/Button';
import { VisitClaim } from '../../types/claim';
import { useClaims } from '../../contexts/ClaimContext';

interface VisitDetailsProps {
  claim: VisitClaim;
}

const VisitDetails: React.FC<VisitDetailsProps> = ({ claim }) => {
  const { updateClaim } = useClaims();
  const [isEditing, setIsEditing] = useState(false);
  const [editedClaim, setEditedClaim] = useState<VisitClaim>(claim);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditedClaim(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      setEditedClaim(prev => ({
        ...prev,
        amount: value,
      }));
    }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setEditedClaim(prev => ({
      ...prev,
      status: e.target.value as VisitClaim['status'],
    }));
  };

  const handleSave = () => {
    updateClaim({
      ...editedClaim,
      updatedAt: new Date().toISOString(),
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedClaim(claim);
    setIsEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <GlassCard className="overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="text-accent-400" size={20} />
            Visit Details
          </h2>
          
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={handleCancel}
                icon={<X size={16} />}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                icon={<Save size={16} />}
              >
                Save
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              onClick={() => setIsEditing(true)}
              icon={<Edit2 size={16} />}
            >
              Edit
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isEditing ? (
            // Edit mode
            <>
              <GlassInput
                label="Visit ID"
                name="visitId"
                value={editedClaim.visitId}
                onChange={handleInputChange}
                icon={<FileText size={18} />}
              />
              
              <GlassInput
                label="Patient Name"
                name="patientName"
                value={editedClaim.patientName}
                onChange={handleInputChange}
                icon={<UserCheck size={18} />}
              />
              
              <GlassDatePicker
                label="Date of Birth"
                name="dob"
                value={editedClaim.dob}
                onChange={(date) => setEditedClaim(prev => ({ ...prev, dob: date }))}
              />
              
              <GlassDatePicker
                label="Date of Service"
                name="dos"
                value={editedClaim.dos}
                onChange={(date) => setEditedClaim(prev => ({ ...prev, dos: date }))}
              />
              
              <GlassInput
                label="Check Number"
                name="checkNumber"
                value={editedClaim.checkNumber}
                onChange={handleInputChange}
                icon={<FileText size={18} />}
              />
              
              <GlassInput
                label="Amount"
                name="amount"
                type="number"
                value={editedClaim.amount.toString()}
                onChange={handleAmountChange}
                icon={<DollarSign size={18} />}
              />
              
              <div className="mb-4">
                <label className="block text-white/80 mb-2 font-medium">
                  Status
                </label>
                <select
                  className="glass-input w-full"
                  value={editedClaim.status}
                  onChange={handleStatusChange}
                >
                  <option value="Posted">Posted</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </>
          ) : (
            // View mode
            <>
              <div className="mb-4">
                <p className="text-white/60 text-sm">Visit ID</p>
                <p className="font-medium">{claim.visitId}</p>
              </div>
              
              <div className="mb-4">
                <p className="text-white/60 text-sm">Patient Name</p>
                <p className="font-medium">{claim.patientName}</p>
              </div>
                <div className="mb-4">
                <p className="text-white/60 text-sm">Date of Birth</p>
                <p className="font-medium">{new Date(claim.dob).toLocaleDateString('en-US', {
                  month: 'numeric',
                  day: 'numeric',
                  year: 'numeric'
                })}</p>
              </div>
              
              <div className="mb-4">
                <p className="text-white/60 text-sm">Date of Service</p>
                <p className="font-medium">{new Date(claim.dos).toLocaleDateString('en-US', {
                  month: 'numeric',
                  day: 'numeric',
                  year: 'numeric'
                })}</p>
              </div>
              
              <div className="mb-4">
                <p className="text-white/60 text-sm">Check Number</p>
                <p className="font-medium">{claim.checkNumber}</p>
              </div>
              
              <div className="mb-4">
                <p className="text-white/60 text-sm">Amount</p>
                <p className="font-medium">${claim.amount.toFixed(2)}</p>
              </div>
              
              <div className="mb-4">
                <p className="text-white/60 text-sm">Status</p>
                <p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-1
                    ${claim.status === 'Posted' ? 'bg-success-900/30 text-success-400' : ''}
                    ${claim.status === 'Pending' ? 'bg-warning-900/30 text-warning-400' : ''}
                    ${claim.status === 'Rejected' ? 'bg-error-900/30 text-error-400' : ''}
                  `}>
                    {claim.status}
                  </span>
                </p>
              </div>
              
              <div className="mb-4">
                <p className="text-white/60 text-sm">Last Updated</p>
                <p className="font-medium">
                  {new Date(claim.updatedAt).toLocaleString()}
                </p>
              </div>
            </>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
};

export default VisitDetails;
