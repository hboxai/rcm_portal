import React from 'react';
import { SearchFilters } from '../../types/claim';
import GlassDateInput from '../ui/GlassDateInput';

// Updated icons to match login page style with white color and glow
const PatientIdIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-purple"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M22 12h-6"></path>
  </svg>
);

const CptIdIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-purple"
  >
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0-2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path>
    <rect x="9" y="3" width="6" height="4" rx="2"></rect>
    <path d="M9 14h.01"></path>
    <path d="M13 14h.01"></path>
    <path d="M9 18h.01"></path>
    <path d="M13 18h.01"></path>
  </svg>
);

const CalendarIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-purple"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

const SearchIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-white"
  >
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

// Sample Billing IDs for autocomplete
const sampleBillingIds = ['170916', 'CPT6249', 'P00234', '11030'];

// Accept filters and setFilters as props to control the form externally
interface SearchFormProps {
  onSearch: (filters: SearchFilters) => void;
  isLoading: boolean;
  filters: SearchFilters;
  setFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  onClear?: () => void;
}

const SearchForm: React.FC<SearchFormProps> = ({ onSearch, isLoading, filters, setFilters, onClear }) => {  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Special handling for date fields - ensure consistent format
    if (name === 'dos' || name === 'dateOfBirth') {
      // Ensure date is in correct format YYYY-MM-DD for backend processing
      if (value) {
        try {
          // Format the date correctly
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD format
            setFilters(prev => ({ ...prev, [name]: formattedDate }));
          } else {
            setFilters(prev => ({ ...prev, [name]: value }));
          }
        } catch (error) {
          console.error(`Error formatting date for ${name}:`, error);
          setFilters(prev => ({ ...prev, [name]: value }));
        }
      } else {
        setFilters(prev => ({ ...prev, [name]: '' }));
      }
    } else {
      // Normal handling for non-date fields
      setFilters(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };  const handleClear = () => {
    setFilters({
      patientId: '',
      billingId: '',
      dos: '',
      firstName: '',
      lastName: '',
      payerName: '',
      dateOfBirth: '',
      cptCode: '',
      clinicName: '',
      providerName: '',
    });
    // Call onClear if provided, to reset search results
    if (onClear) {
      onClear();
    }
  };
  // Common input class to maintain consistent styling with new palette
  const inputClass = "w-full pl-12 border border-purple/30 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue/50 bg-white/90 text-textDark placeholder-purple/50";
  
  // Modified input class for inputs without icons
  const inputNoIconClass = "w-full pl-4 pr-4 border border-purple/30 rounded-lg py-2.5 outline-none focus:ring-2 focus:ring-blue/50 bg-white/90 text-textDark placeholder-purple/50";
  return (
    <div className="mb-8">
      <form onSubmit={handleSubmit} className="glass-card p-6 rounded-xl bg-white/95 backdrop-blur-sm border border-purple/20 text-textDark shadow-lg">
        <div className="card-header rounded-t-lg -mx-6 -mt-6 mb-6">
          <h2 className="text-lg font-semibold">Search Claims</h2>
        </div>        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"> 
          {/* Row 1: First Name, Last Name, DOB, Patient ID */}
          <div>
            <label className="block text-textDark mb-2 font-medium">
              First Name
            </label>
            <div className="relative">
              <input
                name="firstName"
                placeholder="Enter First Name"
                value={filters.firstName}
                onChange={handleChange}
                className={inputNoIconClass}
              />
            </div>          </div>

          <div>
            <label className="block text-textDark mb-2 font-medium">
              Last Name
            </label>
            <div className="relative">
              <input
                name="lastName"
                placeholder="Enter Last Name"
                value={filters.lastName}
                onChange={handleChange}
                className={inputNoIconClass}
              />
            </div>          </div>

          <GlassDateInput
            label="Date of Birth (DOB)"
            name="dateOfBirth"
            value={filters.dateOfBirth || ''}
            onChange={handleChange}
            placeholder="Select Date of Birth"
          />

          <div>
            <label className="block text-textDark mb-2 font-medium">
              Patient ID
            </label>
            <div className="relative">
              <div 
                className="absolute left-3 top-1/2 z-10" 
                style={{
                  transform: 'translateY(-50%)',
                }}
              >
                <PatientIdIcon />
              </div>
              <input
                name="patientId"
                placeholder="Enter patient ID"
                value={filters.patientId}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>          
          
          {/* Row 2: Payer Name, CPT Code, DOS, Billing ID */}
          <div>
            <label className="block text-textDark mb-2 font-medium">
              Payer Name
            </label>
            <div className="relative">
              <input
                name="payerName"
                placeholder="Enter Payer Name"
                value={filters.payerName}
                onChange={handleChange}
                className={inputNoIconClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-textDark mb-2 font-medium">
              CPT Code
            </label>
            <div className="relative">
              <input
                name="cptCode"
                placeholder="Enter CPT Code"
                value={filters.cptCode}
                onChange={handleChange}
                className={inputNoIconClass}
              />
            </div>
          </div>
          
          <GlassDateInput
            label="Date of Service (DOS)"
            name="dos"
            value={filters.dos || ''}
            onChange={handleChange}
            placeholder="Select a date"
          />
          
          <div>
            <label className="block text-textDark mb-2 font-medium">
              Billing ID 
            </label>
            <div className="relative">
              <div 
                className="absolute left-3 top-1/2 z-10" 
                style={{
                  transform: 'translateY(-50%)',
                }}
              >
                <CptIdIcon />
              </div>
              <input
                name="billingId" 
                placeholder="Enter Billing ID"
                value={filters.billingId} 
                onChange={handleChange}
                list="billingIdOptions" 
                className={inputClass}
              />
              <datalist id="billingIdOptions"> 
                {sampleBillingIds.map((id) => (
                  <option key={id} value={id} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Row 3: Clinic Name, Provider Name */}
          <div>
            <label className="block text-textDark mb-2 font-medium">
              Clinic Name
            </label>
            <div className="relative">
              <input
                name="clinicName"
                placeholder="Enter Clinic Name"
                value={filters.clinicName}
                onChange={handleChange}
                className={inputNoIconClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-textDark mb-2 font-medium">
              Provider Name
            </label>
            <div className="relative">
              <input
                name="providerName"
                placeholder="Enter Provider Name"
                value={filters.providerName}
                onChange={handleChange}
                className={inputNoIconClass}
              />
            </div>
          </div>
        </div>
          <div className="flex flex-wrap justify-end gap-4 mt-6">
          <button 
            type="button" 
            onClick={handleClear}
            className="px-6 py-2.5 rounded-lg border border-purple/30 text-textDark bg-white/80 hover:bg-purple/10 transition-colors"
          >
            Clear          </button>
          
          <button 
            type="submit"
            disabled={isLoading}
            className="px-6 py-2.5 rounded-lg bg-purple hover:bg-purple/80 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <SearchIcon />
            )}
            <span>Search</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default SearchForm;
