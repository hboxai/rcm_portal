import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface GlassDateInputProps {
  label?: string;
  name: string;
  value?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
}

const GlassDateInput: React.FC<GlassDateInputProps> = ({ 
  label, 
  name,
  value = '',
  onChange,
  placeholder = "DD-MM-YYYY",
  className = ''
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [displayValue, setDisplayValue] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const textInputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 256 });
  const formatTimeoutRef = useRef<NodeJS.Timeout>();

  // Format date for display (dd-mm-yyyy)
  const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    
    // If it's already in dd-mm-yyyy format, return as is
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
      return dateStr;
    }
    
    try {
      // Handle ISO format (yyyy-mm-dd)
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('-');
        return `${parseInt(day)}-${parseInt(month)}-${year}`;
      }
      
      // Try to parse as date
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return '';
    }
  };

  // Convert display format to ISO format (yyyy-mm-dd)
  const convertToISOFormat = (displayStr: string): string => {
    if (!displayStr) return '';
    
    // Clean the input - remove extra characters
    const cleanStr = displayStr.replace(/[^\d-]/g, '');
    
    // Handle dd-mm-yyyy format
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(cleanStr)) {
      const [day, month, year] = cleanStr.split('-');
      const dayNum = parseInt(day);
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      
      // Validate ranges
      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12) {
        return `${yearNum}-${monthNum.toString().padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
      }
    }
    
    return '';
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (formatTimeoutRef.current) {
        clearTimeout(formatTimeoutRef.current);
      }
    };
  }, []);

  // Update display value when prop value changes
  useEffect(() => {
    setDisplayValue(formatDateForDisplay(value));
  }, [value]);

  // Position picker below the field using viewport coords
  const computePickerPosition = () => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = 256; // match w-64
    const leftMax = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const top = rect.bottom + 8; // 8px gap below input
    setPickerPos({ top, left: leftMax, width });
  };

  useLayoutEffect(() => {
    if (!showDatePicker) return;
    computePickerPosition();
    const onWin = () => computePickerPosition();
    window.addEventListener('scroll', onWin, true);
    window.addEventListener('resize', onWin);
    return () => {
      window.removeEventListener('scroll', onWin, true);
      window.removeEventListener('resize', onWin);
    };
  }, [showDatePicker]);

  const handleTextInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    
    // Clear any pending format timeout
    if (formatTimeoutRef.current) {
      clearTimeout(formatTimeoutRef.current);
    }
    
    // Allow only numbers and dashes
    inputValue = inputValue.replace(/[^\d-]/g, '');
    
    // Auto-insert dashes as user types for better keyboard experience
    const numbersOnly = inputValue.replace(/-/g, '');
    let formatted = '';
    
    for (let i = 0; i < numbersOnly.length && i < 8; i++) {
      formatted += numbersOnly[i];
      // Insert dash after day (2 digits) and after month (4 digits)
      if ((i === 1 || i === 3) && i < numbersOnly.length - 1) {
        formatted += '-';
      }
    }
    
    // Set formatted value immediately for smooth typing
    setDisplayValue(formatted);
    
    // Debounce the validation and parent notification
    formatTimeoutRef.current = setTimeout(() => {
      // Validate day and month ranges
      if (formatted.length >= 2) {
        const parts = formatted.split('-');
        const dayStr = parts[0] || '';
        const monthStr = parts[1] || '';
        const yearStr = parts[2] || '';
        
        let day = parseInt(dayStr) || 0;
        let month = parseInt(monthStr) || 0;
        
        // Clamp day (1-31) and month (1-12)
        if (dayStr.length === 2) {
          day = Math.min(Math.max(day, 1), 31);
        }
        if (monthStr.length === 2) {
          month = Math.min(Math.max(month, 1), 12);
        }
        
        // Reconstruct formatted value with validated ranges
        let validatedFormat = dayStr.length === 2 ? day.toString().padStart(2, '0') : dayStr;
        if (monthStr) {
          validatedFormat += '-' + (monthStr.length === 2 ? month.toString().padStart(2, '0') : monthStr);
        }
        if (yearStr) {
          validatedFormat += '-' + yearStr;
        }
        
        if (validatedFormat !== formatted) {
          setDisplayValue(validatedFormat);
          formatted = validatedFormat;
        }
      }
      
      // Convert to ISO format for parent component only if complete (DD-MM-YYYY)
      if (formatted.length === 10 && /^\d{2}-\d{2}-\d{4}$/.test(formatted)) {
        const [day, month, year] = formatted.split('-');
        const isoDate = `${year}-${month}-${day}`;
        
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            name: name,
            value: isoDate
          }
        };
        onChange(syntheticEvent);
      }
    }, 150); // Reduced debounce for faster feedback
  };

  const handleCalendarClick = () => {
    setShowDatePicker(!showDatePicker);
  };

  const handleDateSelect = (day: number) => {
    const selectedDate = `${day.toString().padStart(2, '0')}-${(currentMonth + 1).toString().padStart(2, '0')}-${currentYear}`;
    setDisplayValue(selectedDate);
    setShowDatePicker(false);
    
    const isoDate = convertToISOFormat(selectedDate);
    const syntheticEvent = {
      target: {
        name: name,
        value: isoDate
      }
    } as React.ChangeEvent<HTMLInputElement>;
    onChange(syntheticEvent);
  };

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
    const days: React.ReactNode[] = [];
    
    // Empty cells for days before first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = day === new Date().getDate() && 
                     currentMonth === new Date().getMonth() && 
                     currentYear === new Date().getFullYear();
      
      days.push(
        <button
          key={day}
          type="button"
          onClick={() => handleDateSelect(day)}
          className={`p-2 text-sm rounded hover:bg-purple/20 transition-colors ${
            isToday ? 'bg-purple text-white' : 'text-gray-700 hover:text-purple'
          }`}
        >
          {day}
        </button>
      );
    }
    
    return days;
  };

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inPicker = datePickerRef.current?.contains(target);
      const inField = containerRef.current?.contains(target);
      if (!inPicker && !inField) setShowDatePicker(false);
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDatePicker(false);
    };

    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showDatePicker]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="block text-textDark mb-2 font-medium">
          {label}
        </label>
      )}
      
  <div className="relative pb-5" ref={containerRef}>
        {/* Calendar Icon */}
        <div 
          className="absolute left-3 top-1/2 z-10 cursor-pointer" 
          style={{
            transform: 'translateY(-50%)',
          }}
          onClick={handleCalendarClick}
        >
          <Calendar size={18} className={`
            transition-colors duration-200
            ${isFocused ? 'text-purple' : 'text-purple/70'}
          `} />
        </div>

        {/* Text Input (visible) */}
        <input
          ref={textInputRef}
          type="text"
          name={`${name}_display`}
          value={displayValue}
          onChange={handleTextInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          maxLength={10}
          autoComplete="off"
          inputMode="numeric"
          className="w-full pl-12 pr-12 border border-purple/30 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue/50 bg-white/90 text-textDark placeholder-purple/50 transition-all duration-200"
        />

        {/* Format hint below input */}
        <div className="absolute -bottom-5 left-0 text-xs text-textDark/50">
          Format: DD-MM-YYYY
        </div>

        {/* Date picker icon */}
        <div 
          className="absolute right-3 top-1/2 z-10 cursor-pointer" 
          style={{
            transform: 'translateY(-50%)',
          }}
          onClick={handleCalendarClick}
        >
          <Calendar size={16} className={`
            transition-colors duration-200
            ${isFocused ? 'text-purple' : 'text-purple/70'}
          `} />
        </div>

        {/* Custom Date Picker via portal (avoids clipping/overflow) */}
        {showDatePicker && ReactDOM.createPortal(
          <div
            ref={datePickerRef}
            className="bg-white border border-purple/30 rounded-lg shadow-2xl w-64"
            style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left, zIndex: 999999 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-purple/20">
              <button
                type="button"
                onClick={() => {
                  if (currentMonth === 0) {
                    setCurrentMonth(11);
                    setCurrentYear(currentYear - 1);
                  } else {
                    setCurrentMonth(currentMonth - 1);
                  }
                }}
                className="p-1 hover:bg-purple/10 rounded"
              >
                <ChevronLeft size={16} className="text-purple" />
              </button>

              <div className="text-sm font-medium text-gray-700">
                {monthNames[currentMonth]} {currentYear}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (currentMonth === 11) {
                    setCurrentMonth(0);
                    setCurrentYear(currentYear + 1);
                  } else {
                    setCurrentMonth(currentMonth + 1);
                  }
                }}
                className="p-1 hover:bg-purple/10 rounded"
              >
                <ChevronRight size={16} className="text-purple" />
              </button>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 border-b border-purple/20">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <div key={day} className="p-2 text-xs font-medium text-gray-500 text-center">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 p-2">
              {renderCalendar()}
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

export default GlassDateInput;
