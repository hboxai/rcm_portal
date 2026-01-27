/**
 * File Upload Sanitization Utility
 * 
 * Validates and sanitizes uploaded files to prevent security vulnerabilities.
 */

import path from 'path';
import crypto from 'crypto';

// Allowed file extensions and their MIME types
export const ALLOWED_FILE_TYPES = {
  // Spreadsheets
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.xls': ['application/vnd.ms-excel'],
  '.csv': ['text/csv', 'text/plain', 'application/csv'],
  // PDFs (for ERA files)
  '.pdf': ['application/pdf'],
} as const;

// Maximum file sizes (in bytes)
export const MAX_FILE_SIZES = {
  spreadsheet: 50 * 1024 * 1024, // 50MB for Excel/CSV
  pdf: 25 * 1024 * 1024, // 25MB for PDFs
  default: 10 * 1024 * 1024, // 10MB default
};

// Dangerous patterns in filenames
const DANGEROUS_PATTERNS = [
  /\.\./,           // Directory traversal
  /[<>:"|?*]/,      // Invalid characters
  /^\.+$/,          // Hidden files (Unix)
  /\x00/,           // Null bytes
  /[\r\n]/,         // Newlines
  /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i, // Windows reserved names
];

// Magic bytes for file type verification
const FILE_SIGNATURES: Record<string, Buffer[]> = {
  '.xlsx': [Buffer.from([0x50, 0x4B, 0x03, 0x04])], // ZIP (XLSX is a ZIP)
  '.xls': [
    Buffer.from([0xD0, 0xCF, 0x11, 0xE0]), // OLE
    Buffer.from([0x09, 0x08, 0x10, 0x00]), // BIFF5
  ],
  '.pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
  '.csv': [], // CSV has no magic bytes, validated by content
};

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedFilename?: string;
  fileType?: string;
}

/**
 * Sanitize filename to prevent path traversal and other attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  let sanitized = path.basename(filename);
  
  // Replace dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '_');
  
  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');
  
  // Limit length
  const ext = path.extname(sanitized);
  const name = path.basename(sanitized, ext);
  const maxNameLength = 200;
  
  if (name.length > maxNameLength) {
    sanitized = name.substring(0, maxNameLength) + ext;
  }
  
  // If filename is empty after sanitization, generate a random one
  if (!sanitized || sanitized === ext) {
    sanitized = `file_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
  }
  
  return sanitized;
}

/**
 * Validate filename for dangerous patterns
 */
export function validateFilename(filename: string): { isValid: boolean; error?: string } {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(filename)) {
      return { isValid: false, error: `Filename contains invalid characters or patterns` };
    }
  }
  
  // Check for double extensions that could be exploits
  const parts = filename.split('.');
  if (parts.length > 2) {
    const secondLast = parts[parts.length - 2].toLowerCase();
    if (['exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js'].includes(secondLast)) {
      return { isValid: false, error: 'Suspicious double extension detected' };
    }
  }
  
  return { isValid: true };
}

/**
 * Validate file extension
 */
export function validateExtension(filename: string): { isValid: boolean; extension?: string; error?: string } {
  const ext = path.extname(filename).toLowerCase();
  
  if (!ext) {
    return { isValid: false, error: 'File has no extension' };
  }
  
  if (!(ext in ALLOWED_FILE_TYPES)) {
    return { 
      isValid: false, 
      error: `File type '${ext}' is not allowed. Allowed: ${Object.keys(ALLOWED_FILE_TYPES).join(', ')}` 
    };
  }
  
  return { isValid: true, extension: ext };
}

/**
 * Validate MIME type matches extension
 */
export function validateMimeType(extension: string, mimeType: string): { isValid: boolean; error?: string } {
  const allowedMimes = ALLOWED_FILE_TYPES[extension as keyof typeof ALLOWED_FILE_TYPES] as readonly string[] | undefined;
  
  if (!allowedMimes) {
    return { isValid: false, error: 'Unknown file extension' };
  }
  
  // Allow if MIME type matches or is generic
  const isAllowed = allowedMimes.includes(mimeType) || 
    mimeType === 'application/octet-stream'; // Generic binary
    
  if (!isAllowed) {
    return { 
      isValid: false, 
      error: `MIME type '${mimeType}' does not match expected types for ${extension}` 
    };
  }
  
  return { isValid: true };
}

/**
 * Validate file size
 */
export function validateFileSize(size: number, extension: string): { isValid: boolean; error?: string } {
  let maxSize = MAX_FILE_SIZES.default;
  
  if (['.xlsx', '.xls', '.csv'].includes(extension)) {
    maxSize = MAX_FILE_SIZES.spreadsheet;
  } else if (extension === '.pdf') {
    maxSize = MAX_FILE_SIZES.pdf;
  }
  
  if (size > maxSize) {
    const maxMB = Math.round(maxSize / 1024 / 1024);
    return { isValid: false, error: `File size exceeds maximum of ${maxMB}MB` };
  }
  
  if (size === 0) {
    return { isValid: false, error: 'File is empty' };
  }
  
  return { isValid: true };
}

/**
 * Verify file magic bytes match expected type
 */
export function verifyMagicBytes(buffer: Buffer, extension: string): { isValid: boolean; error?: string } {
  const signatures = FILE_SIGNATURES[extension];
  
  // CSV has no magic bytes - skip verification
  if (!signatures || signatures.length === 0) {
    return { isValid: true };
  }
  
  for (const sig of signatures) {
    if (buffer.length >= sig.length && buffer.subarray(0, sig.length).equals(sig)) {
      return { isValid: true };
    }
  }
  
  return { 
    isValid: false, 
    error: `File content does not match expected ${extension} format` 
  };
}

/**
 * Comprehensive file validation
 */
export function validateUploadedFile(
  filename: string,
  mimeType: string,
  size: number,
  fileBuffer?: Buffer
): FileValidationResult {
  const errors: string[] = [];
  
  // 1. Validate and sanitize filename
  const filenameValidation = validateFilename(filename);
  if (!filenameValidation.isValid) {
    errors.push(filenameValidation.error!);
  }
  const sanitizedFilename = sanitizeFilename(filename);
  
  // 2. Validate extension
  const extValidation = validateExtension(sanitizedFilename);
  if (!extValidation.isValid) {
    errors.push(extValidation.error!);
    return { isValid: false, errors, sanitizedFilename };
  }
  const extension = extValidation.extension!;
  
  // 3. Validate MIME type
  const mimeValidation = validateMimeType(extension, mimeType);
  if (!mimeValidation.isValid) {
    errors.push(mimeValidation.error!);
  }
  
  // 4. Validate file size
  const sizeValidation = validateFileSize(size, extension);
  if (!sizeValidation.isValid) {
    errors.push(sizeValidation.error!);
  }
  
  // 5. Verify magic bytes if buffer provided
  if (fileBuffer) {
    const magicValidation = verifyMagicBytes(fileBuffer, extension);
    if (!magicValidation.isValid) {
      errors.push(magicValidation.error!);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedFilename,
    fileType: extension,
  };
}

/**
 * Create multer file filter with comprehensive validation
 */
export function createFileFilter(allowedExtensions?: string[]) {
  return (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const extensions = allowedExtensions || Object.keys(ALLOWED_FILE_TYPES);
    const ext = path.extname(file.originalname).toLowerCase();
    
    // Quick extension check
    if (!extensions.includes(ext)) {
      return cb(new Error(`File type '${ext}' is not allowed. Allowed: ${extensions.join(', ')}`));
    }
    
    // Validate filename
    const filenameValidation = validateFilename(file.originalname);
    if (!filenameValidation.isValid) {
      return cb(new Error(filenameValidation.error!));
    }
    
    // Validate MIME type
    const mimeValidation = validateMimeType(ext, file.mimetype);
    if (!mimeValidation.isValid) {
      return cb(new Error(mimeValidation.error!));
    }
    
    cb(null, true);
  };
}

// Type augmentation for multer
import type multer from 'multer';

export default {
  sanitizeFilename,
  validateFilename,
  validateExtension,
  validateMimeType,
  validateFileSize,
  verifyMagicBytes,
  validateUploadedFile,
  createFileFilter,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZES,
};
