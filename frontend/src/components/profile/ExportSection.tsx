import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, X } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import Button from '../ui/Button';
import GlassInput from '../ui/GlassInput';

interface ExportSectionProps {
  claimId?: string; // Accept claim ID if needed
}

const ExportSection: React.FC<ExportSectionProps> = ({ claimId: _claimId }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'single' | 'bulk'>('single');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });
  const [showModal, setShowModal] = useState(false);

  const handleExport = () => {
    // In a real app, this would trigger a download or API call
    setIsExporting(true);
    
    setTimeout(() => {
      setIsExporting(false);
      if (exportType === 'bulk') {
        setShowModal(false);
      }
      // Alert to simulate export completion
      alert(`Exported ${exportType === 'single' ? 'single claim' : 'bulk claims'} successfully!`);
    }, 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="mt-6"
    >
      <GlassCard>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Download className="text-accent-400" size={20} />
            Export Options
          </h2>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              setExportType('single');
              handleExport();
            }}
            isLoading={isExporting && exportType === 'single'}
          >
            Export Single Claim
          </Button>
          
          <Button
            variant="accent"
            className="flex-1"
            onClick={() => {
              setExportType('bulk');
              setShowModal(true);
            }}
          >
            Export in Bulk
          </Button>
        </div>
      </GlassCard>
      
      {/* Bulk Export Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-dark-400/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md"
          >
            <GlassCard variant="dark">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold">Bulk Export</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white/70 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-white/70 mb-4">
                  Select a date range to export multiple claims at once.
                </p>
                
                <GlassInput
                  label="Start Date"
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                />
                
                <GlassInput
                  label="End Date"
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                />
                
                <div className="flex justify-end gap-2 mt-6">
                  <Button
                    variant="secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </Button>
                  
                  <Button
                    onClick={handleExport}
                    isLoading={isExporting}
                    disabled={!dateRange.startDate || !dateRange.endDate}
                  >
                    Export
                  </Button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default ExportSection;
