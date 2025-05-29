import React from 'react';

interface ClaimFieldProps {
  label: string;
  value: any;
  className?: string;
  formatter?: (value: any) => string;
}

/**
 * A consistent component for displaying claim field values
 * Handles null/undefined values and displays "N/A" when needed
 */
const ClaimField: React.FC<ClaimFieldProps> = ({ 
  label, 
  value, 
  className = '',
  formatter
}) => {
  // Default formatter: display N/A for null/undefined/empty values
  const defaultFormatter = (val: any): string => {
    if (val === null || val === undefined || val === '') {
      return 'N/A';
    }
    return String(val);
  };
  
  // Use provided formatter or default
  const formatValue = formatter || defaultFormatter;
  const displayValue = formatValue(value);
  return (
    <div className={`mb-4 ${className}`}>
      <div className="text-textDark/60 text-sm mb-1">{label}</div>
      <div className="text-textDark font-medium">{displayValue}</div>
    </div>
  );
};

// Common formatter functions that can be used
export const formatters = {
  // Currency formatter
  currency: (value: any): string => {
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value));
  },
  
  // Date formatter
  date: (value: any): string => {
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }
    try {
      return new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return 'Invalid Date';
    }
  },
  
  // Percentage formatter
  percentage: (value: any): string => {
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }
    return `${Number(value).toFixed(2)}%`;
  }
};

export default ClaimField;