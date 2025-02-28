/**
 * Logger Service
 * 
 * A centralized logging service using Winston that provides consistent logging
 * throughout the application with different log levels, formats, and transports.
 */
import winston from 'winston';
import path from 'path';
import config from '../config';

// Define custom log format
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define custom console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    ({ level, message, timestamp, ...metadata }) => {
      let metaStr = '';
      if (Object.keys(metadata).length > 0 && metadata.stack !== undefined) {
        metaStr = '\n' + metadata.stack;
      } else if (Object.keys(metadata).length > 0) {
        metaStr = '\n' + JSON.stringify(metadata, null, 2);
      }
      
      return `[${timestamp}] ${level}: ${message}${metaStr}`;
    }
  )
);

/**
 * Creates a new logger instance
 */
const logger = winston.createLogger({
  level: config.logging.level,
  format: customFormat,
  defaultMeta: { service: 'rag-query-system' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({ 
      filename: path.join(config.logging.directory, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Write all logs to combined.log
    new winston.transports.File({ 
      filename: path.join(config.logging.directory, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport for non-production environments
if (config.server.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

/**
 * Adds request context information to the logger
 * @param requestId - The unique identifier for the request
 * @param userId - The user identifier (if authenticated)
 * @returns A child logger with added context
 */
export const createRequestLogger = (requestId: string, userId?: string) => {
  return logger.child({
    requestId,
    userId: userId || 'anonymous',
  });
};

export default logger;
