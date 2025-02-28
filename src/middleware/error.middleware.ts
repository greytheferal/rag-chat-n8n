/**
 * Error Handling Middleware
 * 
 * Provides centralized error handling for the application.
 * Formats error responses and logs errors appropriately.
 */
import { Request, Response, NextFunction } from 'express';
import logger from '../services/logger.service';
import { ErrorResponse } from '../types';

/**
 * Error codes mapped to HTTP status codes
 */
const ERROR_CODES: Record<string, number> = {
  VALIDATION_ERROR: 400,
  AUTHENTICATION_ERROR: 401,
  AUTHORIZATION_ERROR: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT: 429,
  INTERNAL_ERROR: 500,
  DATABASE_ERROR: 503,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 504,
};

/**
 * Custom application error class with error codes
 */
export class AppError extends Error {
  statusCode: number;
  errorCode: string;

  constructor(message: string, errorCode: string = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.errorCode = errorCode;
    this.statusCode = ERROR_CODES[errorCode] || 500;
  }
}

/**
 * Not found middleware - creates 404 errors for undefined routes
 */
export function notFoundMiddleware(req: Request, res: Response, next: NextFunction) {
  const error = new AppError(`Not Found - ${req.originalUrl}`, 'NOT_FOUND');
  next(error);
}

/**
 * Error handling middleware - processes all errors
 */
export function errorHandlerMiddleware(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Set defaults
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let stack: string | undefined;

  // Handle AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
    stack = err.stack;
  } 
  // Handle standard errors
  else if (err instanceof Error) {
    message = err.message;
    stack = err.stack;
    
    // Try to determine error type from message
    if (err.message.includes('validation')) {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
    } else if (err.message.includes('not found') || err.message.includes('does not exist')) {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
    } else if (err.message.includes('timeout') || err.message.toLowerCase().includes('timed out')) {
      statusCode = 504;
      errorCode = 'TIMEOUT';
    } else if (err.message.toLowerCase().includes('database')) {
      statusCode = 503;
      errorCode = 'DATABASE_ERROR';
    }
  }

  // Log error with appropriate severity
  if (statusCode >= 500) {
    logger.error(`[${errorCode}] ${message}`, { stack, path: req.path, method: req.method });
  } else {
    logger.warn(`[${errorCode}] ${message}`, { path: req.path, method: req.method });
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    status: statusCode,
    message,
    errorCode,
  };

  // Include stack trace in development
  if (process.env.NODE_ENV !== 'production' && stack) {
    errorResponse.stack = stack;
  }
  
  // Include more detailed troubleshooting information in development
  if (process.env.NODE_ENV !== 'production') {
    // Add troubleshooting tips based on the error type
    if (errorCode === 'DATABASE_ERROR') {
      errorResponse.details = 'Check database connection and n8n status';
    } else if (errorCode === 'SERVICE_UNAVAILABLE') {
      errorResponse.details = 'Check if OpenAI API is accessible and key is valid';
    } else if (errorCode === 'TIMEOUT') {
      errorResponse.details = 'Request took too long. Try a simpler query or check service status';
    }
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Async handler to catch errors in async route handlers
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next))
      .catch((error) => {
        // Log the error with stack trace for debugging
        logger.error(`Async handler caught error: ${error.message}`, { 
          stack: error.stack,
          path: req.path,
          method: req.method,
          body: req.body ? JSON.stringify(req.body).substring(0, 500) : null
        });
        
        // Make sure we're sending a response to the client
        if (!res.headersSent) {
          // Determine if this is our custom app error or convert it
          const appError = error instanceof AppError
            ? error
            : new AppError(
                error.message || 'An unexpected error occurred',
                error.name === 'TimeoutError' ? 'TIMEOUT' : 'INTERNAL_ERROR'
              );
          
          next(appError);
        } else {
          next(error);
        }
      });
  };
}
