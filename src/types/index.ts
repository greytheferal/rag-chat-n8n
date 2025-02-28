/**
 * Application Type Definitions
 * 
 * This module contains TypeScript interfaces and types used throughout 
 * the application for improved type safety and code documentation.
 */

/**
 * Database schema metadata representation
 */
export interface DatabaseSchema {
  tables: TableMetadata[];
}

/**
 * Table metadata with column information
 */
export interface TableMetadata {
  name: string;
  columns: ColumnMetadata[];
  primaryKey?: string;
  relationships: Relationship[];
}

/**
 * Column metadata with data type and constraints
 */
export interface ColumnMetadata {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  defaultValue?: string;
}

/**
 * Table relationship (foreign key)
 */
export interface Relationship {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

/**
 * Chat message request from client
 */
export interface ChatRequest {
  message: string;
  conversationId?: string;
}

/**
 * Chat message response to client
 */
export interface ChatResponse {
  message: string;
  sql?: string;
  data?: any[];
  conversationId: string;
  filename?: string;
  asynchronous?: boolean; // Indicates if processing is happening asynchronously
}

/**
 * SQL query execution request to n8n
 */
export interface QueryExecutionRequest {
  query: string;
  parameters?: any[];
}

/**
 * SQL query execution response from n8n
 */
export interface QueryExecutionResponse {
  results: any[];
  rowCount: number;
  executionTime: number;
  asynchronous?: boolean; // Indicates if the workflow is executed asynchronously
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  status: number;
  message: string;
  stack?: string;
  errorCode?: string;
}

/**
 * OpenAI service request for SQL generation
 */
export interface SqlGenerationRequest {
  userQuery: string;
  databaseSchema: DatabaseSchema;
}

/**
 * OpenAI service response for SQL generation
 */
export interface SqlGenerationResponse {
  sql: string;
  explanation?: string;
}

/**
 * OpenAI service request for natural language response
 */
export interface NaturalLanguageRequest {
  userQuery: string;
  queryResults: any[];
  sql: string;
}

/**
 * OpenAI service response for natural language
 */
export interface NaturalLanguageResponse {
  answer: string;
}

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  queryText: string;
  userInput: string;
  executionTime?: number;
  rowCount?: number;
  responseStatus: 'success' | 'error' | 'async'; // Added 'async' for asynchronous workflows
  errorMessage?: string;
}
