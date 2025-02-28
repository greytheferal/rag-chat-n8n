/**
 * Chat Controller
 * 
 * Handles chat-related requests including natural language processing,
 * SQL generation, and response formatting.
 */
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ChatRequest, ChatResponse, AuditLogEntry } from '../types';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import { validateChatMessage, validateSqlQuery, ensureQueryLimit, formatTimestamps } from '../utils/validators';
import openAIService from '../services/openai.service';
import schemaService from '../services/schema.service';
import n8nService from '../services/n8n.service';
import databaseService from '../services/database.service';
import logger from '../services/logger.service';

/**
 * Process chat message and return response
 */
export const processChat = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { message, conversationId: existingConversationId } = req.body as ChatRequest;
  
  // Validate chat message
  try {
    validateChatMessage(message);
  } catch (error) {
    throw new AppError(error instanceof Error ? error.message : 'Invalid message', 'VALIDATION_ERROR');
  }
  
  // Generate conversation ID if not provided
  const conversationId = existingConversationId || uuidv4();
  
  // Create request-specific logger
  const requestLogger = logger.child({ conversationId });
  requestLogger.info(`Processing chat message: "${message}"`);
  
  try {
    // Step 1: Get database schema
    requestLogger.info('Getting database schema');
    const databaseSchema = await schemaService.getSchema();
    
    // Step 2: Generate SQL from natural language
    requestLogger.info('Generating SQL query from natural language');
    const sqlGeneration = await openAIService.generateSql({
      userQuery: message,
      databaseSchema,
    });
    
    let sql = sqlGeneration.sql;
    
    // Step 3: Validate and sanitize SQL
    requestLogger.info(`Validating SQL query: ${sql}`);
    try {
      validateSqlQuery(sql);
      sql = ensureQueryLimit(sql);
    } catch (error) {
      throw new AppError(
        `SQL generation failed: ${error instanceof Error ? error.message : 'Invalid SQL'}`,
        'VALIDATION_ERROR'
      );
    }
    
    // Step 4: Execute SQL query via n8n
    requestLogger.info('Executing SQL query via n8n');
    const queryExecution = await n8nService.executeQuery(sql);
    
    // Handle asynchronous workflow case
    if (queryExecution.asynchronous) {
      requestLogger.info('n8n executed the workflow asynchronously. Results not immediately available.');
      
      // Return a response indicating the asynchronous nature
      const response: ChatResponse = {
        message: "Your query is being processed. Results will be available soon.",
        sql,
        data: [],
        conversationId,
        asynchronous: true
      };
      
      // Log the asynchronous execution
      const auditLogEntry: AuditLogEntry = {
        queryText: sql,
        userInput: message,
        responseStatus: 'async',
      };
      await databaseService.logQuery(auditLogEntry);
      
      requestLogger.info('Returning asynchronous response to client');
      return res.status(202).json(response);
    }
    
    // Step 5: Format results (especially timestamps)
    const formattedResults = formatTimestamps(queryExecution.results);
    
    // Step 6: Generate natural language response
    requestLogger.info('Generating natural language response');
    const naturalLanguage = await openAIService.generateResponse({
      userQuery: message,
      sql,
      queryResults: formattedResults,
    });
    
    // Step 7: Log query to audit logs
    const auditLogEntry: AuditLogEntry = {
      queryText: sql,
      userInput: message,
      executionTime: queryExecution.executionTime,
      rowCount: queryExecution.rowCount,
      responseStatus: 'success',
    };
    await databaseService.logQuery(auditLogEntry);
    
    // Optional: Save JSON results for later retrieval
    const jsonData = {
      timestamp: new Date().toISOString(),
      query: sql,
      results: formattedResults,
      userQuery: message,
      naturalLanguageResponse: naturalLanguage.answer
    };
    
    try {
      // Include request ID in the filename
      const requestId = req.headers['x-request-id'] as string;
      const filename = await n8nService.saveResultsAsJson(jsonData, requestId);
      logger.info(`Query results saved to ${filename}`);
    } catch (error) {
      logger.warn('Failed to save results as JSON file', error);
    }
    
    // Step 8: Return response with filename if available
    const response: ChatResponse = {
      message: naturalLanguage.answer,
      sql,
      data: formattedResults,
      conversationId,
      filename: req.headers['x-request-id'] ? 
        `query_${new Date().toISOString().replace(/[:.]/g, '-')}_${(req.headers['x-request-id'] as string).substring(0, 8)}.json` : 
        undefined
    };
    
    requestLogger.info('Chat processing completed successfully');
    return res.status(200).json(response);
  } catch (error) {
    // Log detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    requestLogger.error(`Chat processing failed: ${errorMessage}`, {
      error: errorMessage,
      stack: errorStack,
      step: 'processChat',
    });
    
    // Create more specific error messages based on where the failure happened
    let userFriendlyMessage = 'Failed to process your request';
    let errorCode = 'INTERNAL_ERROR';
    
    if (errorMessage.includes('OpenAI')) {
      userFriendlyMessage = 'Error connecting to AI service. Please try again later.';
      errorCode = 'SERVICE_UNAVAILABLE';
    } else if (errorMessage.includes('n8n') || errorMessage.includes('query')) {
      userFriendlyMessage = 'Error executing database query. The database service may be unavailable.';
      errorCode = 'DATABASE_ERROR';
    } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      userFriendlyMessage = 'The request took too long to process. Please try a simpler query.';
      errorCode = 'TIMEOUT';
    }
    
    // Log audit entry with error
    try {
      const auditLogEntry: AuditLogEntry = {
        queryText: '',
        userInput: message,
        responseStatus: 'error',
        errorMessage: errorMessage,
      };
      await databaseService.logQuery(auditLogEntry);
    } catch (auditError) {
      requestLogger.error('Failed to log error to audit logs', auditError);
    }
    
    // Throw appropriate AppError
    throw new AppError(userFriendlyMessage, errorCode);
  }
});

/**
 * Get database schema information
 */
export const getSchema = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // Force refresh if requested
  const forceRefresh = req.query.refresh === 'true';
  
  logger.info(`Getting database schema (forceRefresh: ${forceRefresh})`);
  const schema = await schemaService.getSchema(forceRefresh);
  
  return res.status(200).json({ schema });
});

/**
 * Get raw query results without natural language processing
 */
export const executeRawQuery = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { query } = req.body;
  
  if (!query || typeof query !== 'string') {
    throw new AppError('Query is required and must be a string', 'VALIDATION_ERROR');
  }
  
  // Validate SQL
  try {
    validateSqlQuery(query);
  } catch (error) {
    throw new AppError(
      `SQL validation failed: ${error instanceof Error ? error.message : 'Invalid SQL'}`,
      'VALIDATION_ERROR'
    );
  }
  
  // Execute query
  logger.info(`Executing raw SQL query: ${query}`);
  const queryExecution = await n8nService.executeQuery(query);
  
  // Format results
  const formattedResults = formatTimestamps(queryExecution.results);
  
  // Log to audit
  const auditLogEntry: AuditLogEntry = {
    queryText: query,
    userInput: 'Raw query execution',
    executionTime: queryExecution.executionTime,
    rowCount: queryExecution.rowCount,
    responseStatus: 'success',
  };
  await databaseService.logQuery(auditLogEntry);
  
  return res.status(200).json({
    results: formattedResults,
    metadata: {
      rowCount: queryExecution.rowCount,
      executionTime: queryExecution.executionTime,
    },
  });
});
