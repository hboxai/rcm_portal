/**
 * Password Validation Utility
 * 
 * Implements password complexity requirements for secure authentication.
 * Based on OWASP password guidelines.
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
}

export interface PasswordRequirements {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  disallowCommonPasswords: boolean;
}

// Default password requirements
export const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  disallowCommonPasswords: true,
};

// List of commonly used passwords that should be disallowed
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456', '12345678', '123456789',
  'qwerty', 'abc123', 'monkey', 'letmein', 'dragon', 'master', 'login',
  'admin', 'welcome', 'iloveyou', 'sunshine', 'princess', 'football',
  'administrator', 'passw0rd', 'p@ssword', 'p@ssw0rd', 'password!',
]);

/**
 * Validates a password against the configured requirements
 */
export function validatePassword(
  password: string,
  requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS
): PasswordValidationResult {
  const errors: string[] = [];
  let strengthScore = 0;

  // Check if password exists
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      errors: ['Password is required'],
      strength: 'weak',
    };
  }

  // Check minimum length
  if (password.length < requirements.minLength) {
    errors.push(`Password must be at least ${requirements.minLength} characters long`);
  } else {
    strengthScore += 1;
  }

  // Check maximum length
  if (password.length > requirements.maxLength) {
    errors.push(`Password must not exceed ${requirements.maxLength} characters`);
  }

  // Check for uppercase letters
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else if (/[A-Z]/.test(password)) {
    strengthScore += 1;
  }

  // Check for lowercase letters
  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else if (/[a-z]/.test(password)) {
    strengthScore += 1;
  }

  // Check for numbers
  if (requirements.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  } else if (/[0-9]/.test(password)) {
    strengthScore += 1;
  }

  // Check for special characters
  const specialCharsRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;
  if (requirements.requireSpecialChars && !specialCharsRegex.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{};\':"|,.<>/?`~)');
  } else if (specialCharsRegex.test(password)) {
    strengthScore += 1;
  }

  // Check for common passwords
  if (requirements.disallowCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lowerPassword)) {
      errors.push('Password is too common. Please choose a more unique password');
    }
  }

  // Extra strength for longer passwords
  if (password.length >= 12) strengthScore += 1;
  if (password.length >= 16) strengthScore += 1;

  // Calculate strength
  let strength: 'weak' | 'fair' | 'good' | 'strong';
  if (strengthScore <= 2) {
    strength = 'weak';
  } else if (strengthScore <= 4) {
    strength = 'fair';
  } else if (strengthScore <= 6) {
    strength = 'good';
  } else {
    strength = 'strong';
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
}

/**
 * Generates a human-readable string of password requirements
 */
export function getPasswordRequirementsMessage(
  requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS
): string {
  const parts: string[] = [];

  parts.push(`at least ${requirements.minLength} characters`);

  if (requirements.requireUppercase) {
    parts.push('one uppercase letter');
  }
  if (requirements.requireLowercase) {
    parts.push('one lowercase letter');
  }
  if (requirements.requireNumbers) {
    parts.push('one number');
  }
  if (requirements.requireSpecialChars) {
    parts.push('one special character');
  }

  return `Password must contain ${parts.join(', ')}.`;
}

export default {
  validatePassword,
  getPasswordRequirementsMessage,
  DEFAULT_PASSWORD_REQUIREMENTS,
};
