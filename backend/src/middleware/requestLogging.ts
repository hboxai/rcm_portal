/**
 * Request Logging Middleware
 * 
 * Attaches request ID to each request and logs request/response details.
 * Request ID is passed to all downstream handlers for correlation.
 */

import { Request, Response, NextFunction } from 'express';
import logger, { generateRequestId, createRequestLogger, logRequest } from '../utils/logger.js';
import { Logger } from 'pino';

// Extend Express Request to include logger and requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      log: Logger;
      startTime?: number;
    }
  }
}

/**
 * Middleware that attaches request ID and logger to each request
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Get request ID from header or generate new one
  const requestId = (req.headers['x-request-id'] as string) || generateRequestId();
  
  // Attach to request object
  req.requestId = requestId;
  req.startTime = Date.now();
  
  // Create child logger with request context
  // User ID will be available after auth middleware runs
  req.log = createRequestLogger(requestId);
  
  // Add request ID to response headers for client correlation
  res.setHeader('X-Request-ID', requestId);
  
  next();
}

/**
 * Middleware that logs completed requests
 * Should be added early in the middleware chain
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Log when response finishes
  res.on('finish', () => {
    const duration = req.startTime ? Date.now() - req.startTime : undefined;
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const userEmail = (req as any).user?.email;

    logRequest({
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration,
      userId,
      userEmail,
    });
  });

  // Log errors
  res.on('error', (error) => {
    const duration = req.startTime ? Date.now() - req.startTime : undefined;
    
    logRequest({
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration,
      error,
    });
  });

  next();
}

/**
 * Combined middleware for easy setup
 */
export function setupRequestLogging(req: Request, res: Response, next: NextFunction): void {
  requestIdMiddleware(req, res, () => {
    requestLoggingMiddleware(req, res, next);
  });
}

export default setupRequestLogging;
