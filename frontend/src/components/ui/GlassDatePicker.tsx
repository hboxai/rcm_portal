import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GlassDatePickerProps {
  label?: string;
  value: string;
  onChange: (date: string) => void;
  error?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  required?: boolean;
  id?: string;
}

const GlassDatePicker: React.FC<GlassDatePickerProps> = ({
  label,
  value,
  onChange,
  error,
  placeholder = 'Select a date',
  className = '',
  disabled = false,
  name,
  required,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(
    value ? new Date(value) : new Date()
  );
  const [isFocused, setIsFocused] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Format the date as YYYY-MM-DD for the input value
  const formatInputDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };
  // Format the date for display in the input field
  const formatDisplayDate = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (e) {
      return '';
    }
  };

  // Get days in the current month
  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Get the day of the week the month starts on (0-6, where 0 is Sunday)
  const getFirstDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month, 1).getDay();
  };

  // Handle clicking outside the picker to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Navigate to the previous month
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  // Navigate to the next month
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Select a date
  const selectDate = (year: number, month: number, day: number) => {
    const newDate = new Date(year, month, day);
    onChange(formatInputDate(newDate));
    setIsOpen(false);
  };

  // Clear the selected date
  const clearDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  // Generate all calendar cells (including empty ones for proper alignment)
  const generateCalendarCells = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const cells = [];
    const selectedDate = value ? new Date(value) : null;
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="h-7"></div>);
    }
    
    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isSelected = selectedDate && 
        date.getDate() === selectedDate.getDate() &&
        date.getMonth() === selectedDate.getMonth() &&
        date.getFullYear() === selectedDate.getFullYear();
      
      const isToday = 
        date.getDate() === new Date().getDate() &&
        date.getMonth() === new Date().getMonth() &&
        date.getFullYear() === new Date().getFullYear();
      
      cells.push(
        <div
          key={day}
          onClick={() => selectDate(year, month, day)}
          className={`h-7 w-7 flex items-center justify-center rounded-full cursor-pointer transition-all duration-300 text-sm mx-auto
            ${
              isSelected
                ? 'bg-gradient-to-r from-primary-500 to-accent-400 shadow-lg shadow-primary-500/20 font-medium text-white scale-105 hover:shadow-xl'
                : isToday
                ? 'bg-white/10 font-medium'
                : 'hover:bg-white/20'
            }
          `}
        >
          {day}
        </div>
      );
    }
    
    return cells;
  };

  // Toggle the picker open/closed
  const togglePicker = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      
      // If opening the picker, update the current month to the selected date or today
      if (!isOpen && value) {
        setCurrentMonth(new Date(value));
      }
    }
  };

  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label className="block text-white/80 mb-2 font-medium">
          {label} {required && <span className="text-error-400">*</span>}
        </label>
      )}
      
      <div className="relative overflow-visible">
        {/* Custom date input */}
        <div 
          className={`relative glass-input w-full flex items-center justify-between cursor-pointer
            ${disabled ? 'opacity-60 cursor-not-allowed' : ''} 
            ${error ? 'border-error-500' : ''} 
            ${isFocused || isOpen ? 'ring-2 ring-primary-500/60 shadow-[0_0_10px_2px_rgba(59,130,246,0.3)]' : ''}
          `}
          onClick={togglePicker}
        >
          <div className="flex items-center w-full">
            <CalendarIcon className="mr-2 h-5 w-5 text-white/70" />
            
            <input
              ref={inputRef}
              type="text"
              readOnly
              id={id}
              name={name}
              placeholder={placeholder}
              value={formatDisplayDate(value)}
              className="bg-transparent border-none outline-none w-full text-white"
              style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={disabled}
            />
            
            {value && (
              <button
                type="button"
                onClick={clearDate}
                className="ml-auto p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="h-4 w-4 text-white/70 hover:text-white" />
              </button>
            )}
          </div>
        </div>
        
        {/* Date picker dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={pickerRef}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute mt-2 left-0 z-50 bg-dark-300/90 border border-white/10 rounded-lg backdrop-blur-xl shadow-xl p-3 w-64"
              style={{ boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
            >
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 text-white/70" />
                </button>
                
                <h3 className="text-white/90 font-medium">
                  {currentMonth.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
                
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  <ChevronRight className="h-5 w-5 text-white/70" />
                </button>
              </div>
              
              {/* Weekdays header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                  <div key={day} className="h-7 flex items-center justify-center text-white/60 text-xs font-medium rounded-md bg-white/5">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1 text-sm font-inter">
                {generateCalendarCells()}
              </div>
              
              {/* Current date shortcut */}
              <div className="mt-3 pt-2 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => selectDate(
                    new Date().getFullYear(),
                    new Date().getMonth(),
                    new Date().getDate()
                  )}
                  className="text-sm text-accent-400 hover:text-accent-300 transition-colors"
                >
                  Today
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {error && (
        <p className="mt-1 text-error-400 text-sm">{error}</p>
      )}
    </div>
  );
};

export default GlassDatePicker;