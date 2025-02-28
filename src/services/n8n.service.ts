/**
 * n8n Service
 * 
 * Handles interaction with n8n workflows for database operations.
 * Provides methods to execute SQL queries and process results.
 */
import axios, { AxiosError } from 'axios';
import fs from 'fs/promises';
import path from 'path';
import config from '../config';
import logger from './logger.service';
import { QueryExecutionRequest, QueryExecutionResponse } from '../types';

class N8nService {
  private webhookUrl: string;
  private jsonOutputDir: string;

  constructor() {
    this.webhookUrl = config.n8n.webhookUrl;
    this.jsonOutputDir = path.join(process.cwd(), 'query_results');
    this.createOutputDirectory();
  }
  
  /**
   * Test connection to n8n webhook
   * @returns Promise that resolves when connection is successful
   */
  public async testConnection(): Promise<void> {
    try {
      // Validate webhook URL
      if (!this.webhookUrl || this.webhookUrl.trim() === '') {
        throw new Error('n8n webhook URL is missing or empty. Please check your .env configuration.');
      }
      
      logger.info(`Testing connection to n8n webhook: ${this.webhookUrl}`);
      
      // The n8n workflow expects data in a specific JSON format
      // We need to send a valid query that matches exactly what the workflow expects
      const response = await axios.post(this.webhookUrl, 
        { 
          query: 'SELECT 1 as connection_test',
          // Make sure all expected fields are present
          userQuery: 'Test connection',
          requestId: 'test-connection'
        },
        { 
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000  // 5 second timeout for connection test
        }
      );
      
      // Check if the response exists and has data
      if (!response || !response.data) {
        throw new Error('n8n returned an empty response');
      }
      
      // Accept different response formats:
      // 1. {"results": [...]} - Standard results format
      // 2. {"message": "Workflow was started"} - Async workflow acknowledgment
      // 3. Any other valid JSON response that indicates n8n received our request
      
      // Check if we got a "Workflow was started" message, which is valid for async workflows
      if (response.data.message === "Workflow was started") {
        logger.info('n8n webhook connection test successful (asynchronous workflow)');
        return;
      }
      
      // Check for results array (synchronous response)
      if (response.data.results && Array.isArray(response.data.results)) {
        logger.info('n8n webhook connection test successful (synchronous workflow)');
        return;
      }
      
      // If we've reached here, we got a response, but it's not in a format we recognize
      // Since n8n is responding, we'll log a warning but consider it successful
      logger.warn(`n8n responded with an unexpected format: ${JSON.stringify(response.data)}. This may be a custom workflow configuration.`);
      logger.info('n8n webhook connection is available but returned an unexpected format');
      
    } catch (error) {
      logger.error(`n8n connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Provide more helpful error messages
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error(`Could not connect to n8n at ${this.webhookUrl}. Make sure n8n is running.`);
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
          throw new Error(`Connection to n8n timed out. The server at ${this.webhookUrl} is not responding.`);
        } else if (error.response) {
          throw new Error(`n8n returned error status ${error.response.status}: ${JSON.stringify(error.response.data)}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Create output directory for JSON query results if it doesn't exist
   */
  private async createOutputDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.jsonOutputDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create JSON output directory', error);
    }
  }

  /**
   * Execute a SQL query via n8n webhook
   * @param query - SQL query to execute
   * @param parameters - Query parameters (optional)
   * @returns Query execution results
   */
  public async executeQuery(
    query: string, 
    parameters?: any[]
  ): Promise<QueryExecutionResponse> {
    const startTime = Date.now();
    
    try {
      logger.info(`Executing SQL query via n8n: ${query}`);
      
      // Validate the n8n webhook URL
      if (!this.webhookUrl || this.webhookUrl.trim() === '') {
        throw new Error('n8n webhook URL is missing or empty. Please check your .env configuration.');
      }
      
      // Create the request object
      const request: QueryExecutionRequest = {
        query,
        parameters,
      };
      
      // Send request to n8n webhook with timeout
      let response;
      try {
        response = await axios.post(this.webhookUrl, request, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        });
      } catch (axiosError) {
        if (axios.isAxiosError(axiosError)) {
          // Handle specific axios errors with helpful messages
          if (axiosError.code === 'ECONNREFUSED') {
            throw new Error(`Could not connect to n8n at ${this.webhookUrl}. Make sure n8n is running.`);
          } else if (axiosError.code === 'ETIMEDOUT' || axiosError.code === 'ECONNABORTED') {
            throw new Error(`Connection to n8n timed out. The server at ${this.webhookUrl} is not responding.`);
          } else if (axiosError.response) {
            throw new Error(`n8n returned error status ${axiosError.response.status}: ${JSON.stringify(axiosError.response.data)}`);
          } else {
            throw new Error(`Failed to communicate with n8n: ${axiosError.message}`);
          }
        }
        throw axiosError; // Re-throw if it's not an axios error
      }
      
      const executionTime = (Date.now() - startTime) / 1000; // in seconds
      
      // Validate response structure with detailed error messages
      if (!response.data) {
        throw new Error('n8n returned an empty response');
      }
      
      // Handle asynchronous workflow responses
      if (response.data.message === "Workflow was started") {
        logger.info('n8n workflow started asynchronously. Results will not be available immediately.');
        
        // For asynchronous workflows, we'll return an empty result set
        // The results would typically be handled through a callback or webhook
        return {
          results: [],
          rowCount: 0,
          executionTime,
          asynchronous: true
        };
      }
      
      // For synchronous workflows, validate the results field
      if (!response.data.results) {
        throw new Error(`n8n response is missing the 'results' field: ${JSON.stringify(response.data)}`);
      }
      
      if (!Array.isArray(response.data.results)) {
        throw new Error(`n8n 'results' field is not an array: ${typeof response.data.results}`);
      }
      
      const results = response.data.results;
      
      logger.info(`Query executed successfully. Returned ${results.length} rows in ${executionTime}s`);
      
      // Try to save results as JSON, but don't fail if this feature fails
      try {
        await this.saveResultsAsJson(query, results);
      } catch (saveError) {
        logger.warn('Failed to save results as JSON, but query was successful', saveError);
      }
      
      return {
        results,
        rowCount: results.length,
        executionTime,
      };
    } catch (error) {
      const executionTime = (Date.now() - startTime) / 1000; // in seconds
      
      if (error instanceof AxiosError) {
        logger.error(`n8n query execution failed (${executionTime}s): ${error.message}`, {
          status: error.response?.status,
          data: error.response?.data,
          url: this.webhookUrl,
          query
        });
      } else {
        logger.error(`n8n query execution failed (${executionTime}s): ${error instanceof Error ? error.message : 'Unknown error'}`, {
          url: this.webhookUrl,
          query
        });
      }
      
      // Create a more specific error message based on the type of error
      let errorMessage = 'Failed to execute query via n8n';
      
      if (error instanceof Error) {
        errorMessage = `${errorMessage}: ${error.message}`;
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Save query results as a JSON file
   * @param data - The data to save (query, results, etc.)
   * @param requestId - Optional request ID for file naming
   * @returns The filename of the saved JSON file
   */
  public async saveResultsAsJson(data: any, requestId?: string): Promise<string> {
    try {
      // Create filename based on timestamp and request ID
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const idPart = requestId ? `_${requestId.substring(0, 8)}` : '';
      const filename = `query_${timestamp}${idPart}.json`;
      const filepath = path.join(this.jsonOutputDir, filename);
      
      // Ensure output directory exists
      await fs.mkdir(this.jsonOutputDir, { recursive: true });
      
      // Write to file
      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
      
      logger.info(`Query results saved to ${filepath}`);
      return filename;
    } catch (error) {
      logger.error('Failed to save query results as JSON', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
const n8nService = new N8nService();
export default n8nService;
