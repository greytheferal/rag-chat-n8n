/**
 * Validation Utilities
 * 
 * Contains functions for input validation, security checks, and data formatting.
 */
import logger from '../services/logger.service';

/**
 * Validates SQL query for potential security issues
 * @param sql - SQL query to validate
 * @returns True if valid, throws error if invalid
 */
export function validateSqlQuery(sql: string): boolean {
  // Check for dangerous operations
  const dangerousPatterns = [
    /DROP\s+/i,
    /DELETE\s+/i,
    /TRUNCATE\s+/i,
    /INSERT\s+/i,
    /UPDATE\s+/i,
    /ALTER\s+/i,
    /CREATE\s+/i,
    /GRANT\s+/i,
    /REVOKE\s+/i,
    /RENAME\s+/i,
    /LOAD\s+DATA/i,
    /INTO\s+OUTFILE/i,
    /INFORMATION_SCHEMA/i,
    /SLEEP\s*\(/i,
    /BENCHMARK\s*\(/i,
    /SHUTDOWN/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(sql)) {
      const match = sql.match(pattern);
      throw new Error(`SQL validation failed: Potentially dangerous operation detected (${match?.[0]})`);
    }
  }

  // Check for basic SQL syntax
  if (!sql.trim().toUpperCase().startsWith('SELECT')) {
    throw new Error('SQL validation failed: Query must start with SELECT');
  }

  // Check for balanced parentheses
  const openParenCount = (sql.match(/\(/g) || []).length;
  const closeParenCount = (sql.match(/\)/g) || []).length;
  
  if (openParenCount !== closeParenCount) {
    throw new Error('SQL validation failed: Unbalanced parentheses');
  }

  // Check for semicolons (potential for multiple statements)
  if (sql.includes(';') && !sql.trim().endsWith(';')) {
    throw new Error('SQL validation failed: Multiple statements detected');
  }

  // Check for comments (could be used to hide malicious code)
  if (sql.includes('--') || sql.includes('/*')) {
    throw new Error('SQL validation failed: Comments are not allowed');
  }

  // Check query length
  if (sql.length > 2000) {
    throw new Error('SQL validation failed: Query too long');
  }

  return true;
}

/**
 * Adds a limit clause to a SQL query if not present
 * @param sql - SQL query
 * @param limit - Maximum number of rows
 * @returns SQL query with limit
 */
export function ensureQueryLimit(sql: string, limit: number = 100): string {
  // Check if query already has a LIMIT clause
  if (/LIMIT\s+\d+/i.test(sql)) {
    return sql;
  }
  
  // Add LIMIT clause
  const trimmedSql = sql.trim();
  const sqlWithLimit = trimmedSql.endsWith(';')
    ? `${trimmedSql.slice(0, -1)} LIMIT ${limit};`
    : `${trimmedSql} LIMIT ${limit}`;
  
  return sqlWithLimit;
}

/**
 * Format timestamp values in query results
 * @param results - Query result objects
 * @returns Formatted result objects
 */
export function formatTimestamps(results: any[]): any[] {
  if (!Array.isArray(results)) {
    return results;
  }
  
  return results.map(row => {
    const formattedRow = { ...row };
    
    // Iterate through all properties
    for (const [key, value] of Object.entries(formattedRow)) {
      // Check if value is a Date object or date string
      if (value instanceof Date) {
        formattedRow[key] = formatDate(value);
      } else if (
        typeof value === 'string' && 
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
      ) {
        formattedRow[key] = formatDate(new Date(value));
      }
    }
    
    return formattedRow;
  });
}

/**
 * Format a date object to YYYY-MM-DD HH:MM:SS
 * @param date - Date object
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return 'Invalid Date';
  }
  
  return date.toISOString()
    .replace('T', ' ')
    .substring(0, 19);
}

/**
 * Validate a chat message for basic requirements
 * @param message - Chat message to validate
 * @returns True if valid, throws error if invalid
 */
export function validateChatMessage(message: string): boolean {
  if (!message || typeof message !== 'string') {
    throw new Error('Message is required and must be a string');
  }
  
  if (message.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }
  
  if (message.length > 1000) {
    throw new Error('Message is too long (maximum 1000 characters)');
  }
  
  return true;
}

/**
 * Sanitize a string for logging and display
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .trim();
}
