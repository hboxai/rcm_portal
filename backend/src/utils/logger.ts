/**
 * Structured Logger for RCM Portal
 * 
 * Uses pino for high-performance structured logging with:
 * - Log levels (trace, debug, info, warn, error, fatal)
 * - Request ID tracking
 * - Pretty printing in development
 * - JSON format in production (for log aggregation)
 */

import pino, { Logger, LoggerOptions } from 'pino';
import { randomUUID } from 'crypto';

// Environment-based configuration
const isDevelopment = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

// Base configuration
const baseOptions: LoggerOptions = {
  level: logLevel,
  // Add timestamp in ISO format
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  // Base fields included in every log
  base: {
    service: 'rcm-portal-backend',
    env: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '0.9.0',
  },
  // Redact sensitive fields
  redact: {
    paths: [
      'password',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.secret',
      '*.apiKey',
      '*.api_key',
    ],
    remove: true,
  },
  // Custom serializers
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => ({
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      headers: {
        'user-agent': req.headers?.['user-agent'],
        'content-type': req.headers?.['content-type'],
        host: req.headers?.host,
      },
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
};

// Development pretty printing options
const devTransport = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:HH:MM:ss.l',
    ignore: 'pid,hostname,service,env,version',
    messageFormat: '{requestId} {msg}',
    singleLine: false,
  },
};

// Create the base logger
let logger: Logger;

if (isDevelopment) {
  // In development, use pretty printing if pino-pretty is available
  try {
    require.resolve('pino-pretty');
    logger = pino({
      ...baseOptions,
      transport: devTransport,
    });
  } catch {
    // Fallback to basic pino if pino-pretty not installed
    logger = pino(baseOptions);
  }
} else {
  // In production, use JSON format
  logger = pino(baseOptions);
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return randomUUID().slice(0, 8);
}

/**
 * Create a child logger with request context
 */
export function createRequestLogger(requestId: string, userId?: number | string): Logger {
  return logger.child({
    requestId,
    ...(userId && { userId }),
  });
}

/**
 * Log levels for different scenarios
 */
export const LogLevel = {
  /** Most fine-grained, typically disabled in production */
  TRACE: 'trace',
  /** Debug information for development */
  DEBUG: 'debug',
  /** Normal operational messages */
  INFO: 'info',
  /** Something unexpected but not critical */
  WARN: 'warn',
  /** Error that needs attention */
  ERROR: 'error',
  /** System is unusable */
  FATAL: 'fatal',
} as const;

/**
 * Log categories for organized logging
 */
export const LogCategory = {
  AUTH: 'auth',
  API: 'api',
  DATABASE: 'database',
  UPLOAD: 'upload',
  PARSE: 'parse',
  S3: 's3',
  MAIL: 'mail',
  SYSTEM: 'system',
} as const;

/**
 * Create a category-specific logger
 */
export function getCategoryLogger(category: keyof typeof LogCategory): Logger {
  return logger.child({ category });
}

/**
 * HTTP request/response logging helper
 */
export interface RequestLogData {
  requestId: string;
  method: string;
  url: string;
  statusCode?: number;
  duration?: number;
  userId?: number | string;
  userEmail?: string;
  error?: Error | string;
}

export function logRequest(data: RequestLogData): void {
  const { requestId, method, url, statusCode, duration, userId, userEmail, error } = data;
  
  const logData = {
    requestId,
    http: {
      method,
      url,
      statusCode,
      duration: duration ? `${duration}ms` : undefined,
    },
    user: userId || userEmail ? { id: userId, email: userEmail } : undefined,
  };

  if (error) {
    logger.error({ ...logData, err: error }, `${method} ${url} - ${statusCode || 'ERROR'}`);
  } else if (statusCode && statusCode >= 400) {
    logger.warn(logData, `${method} ${url} - ${statusCode}`);
  } else {
    logger.info(logData, `${method} ${url} - ${statusCode || 'PENDING'}`);
  }
}

/**
 * Database query logging helper
 */
export function logQuery(query: string, params?: unknown[], duration?: number): void {
  const dbLogger = getCategoryLogger('DATABASE');
  dbLogger.debug({
    query: query.length > 200 ? query.substring(0, 200) + '...' : query,
    paramCount: params?.length,
    duration: duration ? `${duration}ms` : undefined,
  }, 'Database query');
}

/**
 * File upload logging helper  
 */
export function logUpload(data: {
  filename: string;
  size: number;
  type: string;
  userId?: number | string;
  success: boolean;
  error?: string;
}): void {
  const uploadLogger = getCategoryLogger('UPLOAD');
  const logData = {
    file: {
      name: data.filename,
      size: data.size,
      type: data.type,
    },
    userId: data.userId,
    success: data.success,
  };

  if (data.success) {
    uploadLogger.info(logData, `File uploaded: ${data.filename}`);
  } else {
    uploadLogger.error({ ...logData, error: data.error }, `Upload failed: ${data.filename}`);
  }
}

/**
 * Auth event logging helper
 */
export function logAuthEvent(data: {
  action: 'login' | 'logout' | 'register' | 'password_change' | 'login_failed';
  userId?: number | string;
  userEmail: string;
  ip?: string;
  success: boolean;
  reason?: string;
}): void {
  const authLogger = getCategoryLogger('AUTH');
  const logData = {
    action: data.action,
    userId: data.userId,
    userEmail: data.userEmail,
    ip: data.ip,
    success: data.success,
  };

  if (data.success) {
    authLogger.info(logData, `Auth: ${data.action} for ${data.userEmail}`);
  } else {
    authLogger.warn({ ...logData, reason: data.reason }, `Auth failed: ${data.action} for ${data.userEmail}`);
  }
}

// Export the base logger for direct use
export default logger;

// Named exports for convenience
export { logger };
