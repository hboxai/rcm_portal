import React, { useState, useEffect } from 'react';
import { Check, X, Eye, EyeOff } from 'lucide-react';
import GlassInput from '../ui/GlassInput';

interface PasswordRequirement {
  id: string;
  label: string;
  regex: RegExp;
  met: boolean;
}

interface PasswordInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  name?: string;
  showRequirements?: boolean;
  isOptional?: boolean; // For edit mode where password can be left blank
  className?: string;
}

const PASSWORD_REQUIREMENTS: Omit<PasswordRequirement, 'met'>[] = [
  { id: 'length', label: 'At least 8 characters', regex: /.{8,}/ },
  { id: 'uppercase', label: 'One uppercase letter (A-Z)', regex: /[A-Z]/ },
  { id: 'lowercase', label: 'One lowercase letter (a-z)', regex: /[a-z]/ },
  { id: 'number', label: 'One number (0-9)', regex: /[0-9]/ },
  { id: 'special', label: 'One special character (!@#$%^&*)', regex: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/ },
];

/**
 * Calculate password strength based on requirements met
 */
function getPasswordStrength(password: string): { level: 'empty' | 'weak' | 'fair' | 'good' | 'strong'; score: number } {
  if (!password) return { level: 'empty', score: 0 };
  
  let score = 0;
  
  // Check each requirement
  PASSWORD_REQUIREMENTS.forEach(req => {
    if (req.regex.test(password)) score++;
  });
  
  // Bonus for extra length
  if (password.length >= 12) score += 0.5;
  if (password.length >= 16) score += 0.5;
  
  // Map score to strength level
  if (score <= 2) return { level: 'weak', score: 25 };
  if (score <= 3) return { level: 'fair', score: 50 };
  if (score <= 4) return { level: 'good', score: 75 };
  return { level: 'strong', score: 100 };
}

const PasswordInput: React.FC<PasswordInputProps> = ({
  value,
  onChange,
  label = 'Password',
  placeholder = 'Enter password',
  error,
  name = 'password',
  showRequirements = true,
  isOptional = false,
  className = '',
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [requirements, setRequirements] = useState<PasswordRequirement[]>(
    PASSWORD_REQUIREMENTS.map(req => ({ ...req, met: false }))
  );
  const [strength, setStrength] = useState<{ level: 'empty' | 'weak' | 'fair' | 'good' | 'strong'; score: number }>({ level: 'empty', score: 0 });

  // Update requirements check when value changes
  useEffect(() => {
    const updatedReqs = PASSWORD_REQUIREMENTS.map(req => ({
      ...req,
      met: req.regex.test(value),
    }));
    setRequirements(updatedReqs);
    setStrength(getPasswordStrength(value));
  }, [value]);

  // Color based on strength
   
  const _getStrengthColor = () => {
    switch (strength.level) {
      case 'weak': return 'bg-red-500';
      case 'fair': return 'bg-yellow-500';
      case 'good': return 'bg-blue-500';
      case 'strong': return 'bg-green-500';
      default: return 'bg-gray-300';
    }
  };

  const getStrengthLabel = () => {
    switch (strength.level) {
      case 'weak': return 'Weak';
      case 'fair': return 'Fair';
      case 'good': return 'Good';
      case 'strong': return 'Strong';
      default: return '';
    }
  };

  return (
    <div className={className}>
      <div className="relative">
        <GlassInput
          label={isOptional ? `${label} (Leave blank to keep current)` : label}
          name={name}
          type={showPassword ? 'text' : 'password'}
          placeholder={isOptional ? '••••••••' : placeholder}
          value={value}
          onChange={onChange}
          error={error}
          labelClassName="text-textDark/80"
          inputClassName="text-textDark placeholder:text-textDark/60 pr-10"
          className="border-purple/30 focus:border-purple"
        />
        {/* Show/Hide password toggle */}
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-[38px] text-purple/60 hover:text-purple transition-colors"
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff size={18} />
          ) : (
            <Eye size={18} />
          )}
        </button>
      </div>

      {/* Only show requirements if showRequirements is true and either:
          - It's not optional (create mode)
          - Or it's optional but has a value (user started typing) */}
      {showRequirements && (!isOptional || value) && (
        <div className="mt-3 space-y-2">
          {/* Strength indicator bar */}
          {value && (
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-textDark/60">Password strength</span>
                <span className={`text-xs font-medium ${
                  strength.level === 'weak' ? 'text-red-500' :
                  strength.level === 'fair' ? 'text-yellow-600' :
                  strength.level === 'good' ? 'text-blue-500' :
                  strength.level === 'strong' ? 'text-green-500' :
                  'text-gray-400'
                }`}>
                  {getStrengthLabel()}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-300"
                  style={{ 
                    width: `${strength.score}%`,
                    backgroundColor: strength.level === 'weak' ? '#ef4444' :
                                    strength.level === 'fair' ? '#eab308' :
                                    strength.level === 'good' ? '#3b82f6' :
                                    strength.level === 'strong' ? '#22c55e' : '#d1d5db'
                  }}
                />
              </div>
            </div>
          )}

          {/* Requirements checklist */}
          <div className="text-xs text-textDark/70 space-y-1.5">
            <p className="font-medium mb-2">Password must have:</p>
            {requirements.map(req => (
              <div 
                key={req.id}
                className={`flex items-center gap-2 transition-colors duration-200 ${
                  value ? (req.met ? 'text-green-600' : 'text-red-500') : 'text-textDark/50'
                }`}
              >
                {value ? (
                  req.met ? (
                    <Check size={14} className="text-green-500" />
                  ) : (
                    <X size={14} className="text-red-400" />
                  )
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-textDark/30" />
                )}
                <span>{req.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PasswordInput;
