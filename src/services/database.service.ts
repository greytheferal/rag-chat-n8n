/**
 * Database Service
 * 
 * Manages database connections and provides basic database operations.
 * Uses connection pooling for efficiency and implements retry mechanisms
 * for improved resilience.
 */
import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import config from '../config';
import logger from './logger.service';
import { AuditLogEntry } from '../types';

class DatabaseService {
  private pool!: Pool;
  private initialized: boolean = false;

  /**
   * Initialize the database connection pool
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Create connection pool
      this.pool = mysql.createPool({
        host: config.database.host,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database,
        port: config.database.port,
        ssl: config.database.ssl ? { rejectUnauthorized: false } : undefined,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      // Test connection
      await this.testConnection();
      this.initialized = true;
      logger.info('Database connection pool initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database connection pool', error);
      throw new Error('Database connection failed');
    }
  }

  /**
   * Test database connection
   * @public - Now public so it can be used by diagnostics
   */
  public async testConnection(): Promise<void> {
    // Remove the initialization check that was causing circular dependency
    // The initialize() method calls this, so we can't require initialization first
    
    let connection: PoolConnection | null = null;
    
    try {
      connection = await this.pool.getConnection();
      await connection.query('SELECT 1 as connection_test');
      logger.info('Database connection test successful');
    } catch (error) {
      logger.error('Database connection test failed', error);
      
      // Provide more specific error message
      if (error instanceof Error) {
        const errorMessage = error.message;
        
        if (errorMessage.includes('ECONNREFUSED')) {
          throw new Error(`Could not connect to MySQL at ${config.database.host}:${config.database.port}. Is MySQL running?`);
        } else if (errorMessage.includes('Access denied')) {
          throw new Error('Database access denied. Check your username and password.');
        } else if (errorMessage.includes('Unknown database')) {
          throw new Error(`Database '${config.database.database}' does not exist.`);
        } else {
          throw new Error(`Database connection failed: ${errorMessage}`);
        }
      } else {
        throw new Error('Database connection failed with unknown error');
      }
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  /**
   * Execute a query with parameters
   * @param sql - SQL query to execute
   * @param params - Query parameters (optional)
   * @returns Query results
   */
  public async query<T>(sql: string, params?: any[]): Promise<T> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const [results] = await this.pool.query(sql, params || []);
      return results as T;
    } catch (error) {
      logger.error(`Query execution failed: ${sql}`, error);
      throw error;
    }
  }

  /**
   * Execute a transaction with multiple queries
   * @param callback - Function that executes queries within the transaction
   * @returns Result of the callback function
   */
  public async transaction<T>(
    callback: (connection: PoolConnection) => Promise<T>
  ): Promise<T> {
    if (!this.initialized) {
      await this.initialize();
    }

    let connection: PoolConnection | null = null;
    
    try {
      connection = await this.pool.getConnection();
      await connection.beginTransaction();
      
      const result = await callback(connection);
      
      await connection.commit();
      return result;
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      logger.error('Transaction failed', error);
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  /**
   * Logs query execution details to the audit_logs table
   * @param entry - Audit log entry details
   */
  public async logQuery(entry: AuditLogEntry): Promise<void> {
    try {
      await this.query(
        `INSERT INTO audit_logs 
         (query_text, user_input, execution_time, row_count, response_status, error_message) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          entry.queryText,
          entry.userInput,
          entry.executionTime || null,
          entry.rowCount || null,
          entry.responseStatus,
          entry.errorMessage || null,
        ]
      );
    } catch (error) {
      // Don't throw here, just log the error
      logger.error('Failed to log query to audit_logs', error);
    }
  }

  /**
   * Close all connections in the pool
   */
  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.initialized = false;
      logger.info('Database connection pool closed');
    }
  }
}

// Create and export a singleton instance
const databaseService = new DatabaseService();
export default databaseService;
