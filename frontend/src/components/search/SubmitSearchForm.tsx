import React from 'react';
import { SearchFilters } from '../../types/claim';
import GlassDateInput from '../ui/GlassDateInput';

type Props = {
  onSearch: (filters: SearchFilters) => void;
  isLoading: boolean;
  filters: SearchFilters;
  setFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  onClear?: () => void;
};

const SubmitSearchForm: React.FC<Props> = ({ onSearch, isLoading, filters, setFilters, onClear }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };

  const handleClear = () => {
    setFilters({ firstName: '', lastName: '', clinicName: '', dateOfBirth: '', payerName: '', cptCode: '' } as any);
    onClear?.();
  };

  const inputNoIconClass = "w-full pl-4 pr-4 border border-purple/30 rounded-lg py-2.5 outline-none focus:ring-2 focus:ring-blue/50 bg-white/90 text-textDark placeholder-purple/50";

  return (
    <div className="mb-8">
      <form onSubmit={handleSubmit} className="glass-card p-6 rounded-xl bg-white/95 backdrop-blur-sm border border-purple/20 text-textDark shadow-lg">
        <div className="card-header rounded-t-lg -mx-6 -mt-6 mb-6">
          <h2 className="text-lg font-semibold">Search Claims</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-textDark mb-2 font-medium">First Name</label>
            <input name="firstName" placeholder="Enter First Name" value={filters.firstName || ''} onChange={handleChange} className={inputNoIconClass} />
          </div>
          <div>
            <label className="block text-textDark mb-2 font-medium">Last Name</label>
            <input name="lastName" placeholder="Enter Last Name" value={filters.lastName || ''} onChange={handleChange} className={inputNoIconClass} />
          </div>
          <div>
            <label className="block text-textDark mb-2 font-medium">Clinic Name</label>
            <input name="clinicName" placeholder="Enter Clinic Name" value={filters.clinicName || ''} onChange={handleChange} className={inputNoIconClass} />
          </div>
          <GlassDateInput
            label="Date of Birth (DOB)"
            name="dateOfBirth"
            value={filters.dateOfBirth || ''}
            onChange={handleChange}
            placeholder="dd-mm-yyyy"
          />
          <div>
            <label className="block text-textDark mb-2 font-medium">Payer Name</label>
            <input name="payerName" placeholder="Enter Payer Name" value={filters.payerName || ''} onChange={handleChange} className={inputNoIconClass} />
          </div>
          <div>
            <label className="block text-textDark mb-2 font-medium">CPT Code</label>
            <input name="cptCode" placeholder="e.g. 99213" value={filters.cptCode || ''} onChange={handleChange} className={inputNoIconClass} />
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-4 mt-6">
          <button type="button" onClick={handleClear} className="px-6 py-2.5 rounded-lg border border-purple/30 text-textDark bg-white/80 hover:bg-purple/10 transition-colors">Clear</button>
          <button type="submit" disabled={isLoading} className="px-6 py-2.5 rounded-lg bg-purple hover:bg-purple/80 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            <span>Search</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default SubmitSearchForm;
