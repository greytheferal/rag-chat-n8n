/**
 * OpenAI Service
 * 
 * Provides functionality to interact with OpenAI's API for:
 * 1. Converting natural language to SQL queries
 * 2. Generating natural language responses from query results
 */
import OpenAI from 'openai';
import config from '../config';
import logger from './logger.service';
import { 
  DatabaseSchema, 
  SqlGenerationRequest, 
  SqlGenerationResponse,
  NaturalLanguageRequest,
  NaturalLanguageResponse
} from '../types';
import schemaService from './schema.service';

class OpenAIService {
  private openai: OpenAI;
  private initialized: boolean = false;
  
  /**
   * Check if the service is initialized
   * @returns True if initialized, false otherwise
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Initialize the OpenAI client
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Validate API key is present
      if (!config.openai.apiKey) {
        throw new Error('OpenAI API key is missing. Please check your .env file.');
      }
      
      if (config.openai.apiKey.trim() === '') {
        throw new Error('OpenAI API key is empty. Please provide a valid API key in your .env file.');
      }
      
      // Create OpenAI client
      this.openai = new OpenAI({
        apiKey: config.openai.apiKey,
      });
      
      // Test the connection with a simple request
      logger.info('Testing OpenAI API connection...');
      const testResponse = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello, are you working? Please respond with only yes or no.' }
        ],
        max_tokens: 10,
      });
      
      if (!testResponse || !testResponse.choices || testResponse.choices.length === 0) {
        throw new Error('OpenAI API test failed: No response received');
      }
      
      this.initialized = true;
      logger.info('OpenAI service initialized and tested successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to initialize OpenAI service: ${errorMessage}`, error);
      
      // Provide helpful error message based on common issues
      if (errorMessage.includes('API key')) {
        throw new Error(`OpenAI initialization failed: ${errorMessage}`);
      } else if (errorMessage.includes('status code 401')) {
        throw new Error('OpenAI initialization failed: Invalid API key or unauthorized access');
      } else if (errorMessage.includes('status code 429')) {
        throw new Error('OpenAI initialization failed: Rate limit exceeded. Please try again later.');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')) {
        throw new Error('OpenAI initialization failed: Could not connect to OpenAI API. Please check your internet connection.');
      } else {
        throw new Error(`OpenAI initialization failed: ${errorMessage}`);
      }
    }
  }

  /**
   * Convert natural language query to SQL
   * @param request - SQL generation request containing user query and schema
   * @returns SQL query string and optional explanation
   */
  public async generateSql(request: SqlGenerationRequest): Promise<SqlGenerationResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.info(`Generating SQL for query: "${request.userQuery}"`);
      
      // Create schema description for the prompt
      const schemaDescription = schemaService.getSchemaDescription(request.databaseSchema);
      
      // Build the prompt for SQL generation
      const prompt = this.buildSqlGenerationPrompt(request.userQuery, schemaDescription);
      
      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: prompt.system,
          },
          {
            role: 'user',
            content: prompt.user,
          },
        ],
        temperature: 0.2, // Lower temperature for more deterministic SQL generation
        max_tokens: config.openai.maxTokens,
      });
      
      // Extract SQL from response
      const content = response.choices[0]?.message?.content || '';
      const sqlQuery = this.extractSqlFromResponse(content);
      
      if (!sqlQuery) {
        throw new Error('Failed to generate valid SQL query');
      }
      
      logger.info(`SQL generated successfully: ${sqlQuery}`);
      
      return {
        sql: sqlQuery,
        explanation: content.replace(sqlQuery, '').trim(),
      };
    } catch (error) {
      logger.error('SQL generation failed', error);
      throw new Error(`Failed to generate SQL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate natural language response from query results
   * @param request - Request containing user query, results and SQL
   * @returns Natural language answer
   */
  public async generateResponse(request: NaturalLanguageRequest): Promise<NaturalLanguageResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.info(`Generating response for query: "${request.userQuery}"`);
      
      // Format query results for the prompt
      const formattedResults = this.formatQueryResults(request.queryResults);
      
      // Build the prompt for response generation
      const prompt = this.buildResponseGenerationPrompt(
        request.userQuery, 
        request.sql, 
        formattedResults
      );
      
      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: prompt.system,
          },
          {
            role: 'user',
            content: prompt.user,
          },
        ],
        temperature: 0.7, // Higher temperature for more natural language
        max_tokens: config.openai.maxTokens,
      });
      
      const answer = response.choices[0]?.message?.content || '';
      
      logger.info('Response generated successfully');
      
      return { answer };
    } catch (error) {
      logger.error('Response generation failed', error);
      throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Builds a prompt for SQL generation
   * @param userQuery - Natural language query from user
   * @param schemaDescription - Database schema description
   * @returns System and user prompt components
   */
  private buildSqlGenerationPrompt(
    userQuery: string, 
    schemaDescription: string
  ): { system: string; user: string } {
    const systemPrompt = `You are an expert database engineer that converts natural language questions into SQL queries.
Your task is to generate a valid MySQL SQL query based on the database schema provided and the user's natural language question.

Follow these rules:
1. Generate ONLY the SQL query without explanation or markdown formatting.
2. The query should be read-only (SELECT) for security reasons.
3. NEVER use DROP, DELETE, INSERT, UPDATE, or other data modification statements.
4. Limit results to 100 rows maximum unless specifically requested otherwise.
5. Format dates in the results as YYYY-MM-DD HH:MM:SS.
6. Use proper JOINs when querying across multiple tables.
7. Include appropriate WHERE clauses to filter data according to the user's question.
8. If the query involves filtering by a specific value mentioned in the user's question, make sure to include that in a WHERE clause.
9. Keep the SQL query as simple as possible while still answering the user's question correctly.`;

    const userPrompt = `${schemaDescription}

User Question: "${userQuery}"

Generate the SQL query:`;

    return {
      system: systemPrompt,
      user: userPrompt,
    };
  }

  /**
   * Builds a prompt for natural language response generation
   * @param userQuery - Original user query
   * @param sql - SQL query that was executed
   * @param formattedResults - Formatted query results
   * @returns System and user prompt components
   */
  private buildResponseGenerationPrompt(
    userQuery: string,
    sql: string,
    formattedResults: string
  ): { system: string; user: string } {
    const systemPrompt = `You are a helpful assistant answering questions about database information.
Your task is to provide a natural language response that directly answers the user's question based on the database query results.

Follow these rules:
1. Be concise but informative.
2. If the results are empty, explain that no matching data was found.
3. Include relevant numbers and statistics from the results.
4. Do not include the SQL query in your response unless specifically asked.
5. Format your response in a conversational, helpful manner.
6. Provide context and explanation for the data when appropriate.
7. If there are obvious trends or patterns in the data, mention them.`;

    const userPrompt = `User Question: "${userQuery}"

The following SQL query was executed:
\`\`\`sql
${sql}
\`\`\`

Database Query Results:
${formattedResults}

Please provide a natural language response that directly answers the user's question based on these results.`;

    return {
      system: systemPrompt,
      user: userPrompt,
    };
  }

  /**
   * Extract SQL query from LLM response
   * @param response - Full text response from OpenAI
   * @returns SQL query string
   */
  private extractSqlFromResponse(response: string): string {
    // Try to extract SQL from markdown code blocks
    const markdownMatch = response.match(/```sql\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
      return markdownMatch[1].trim();
    }

    // Try to extract SQL from non-markdown code blocks
    const codeBlockMatch = response.match(/```\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      return codeBlockMatch[1].trim();
    }

    // If no code blocks, assume the whole response is SQL
    // Filter out any natural language explanations
    const lines = response.split('\n').filter(line => 
      !line.startsWith('Here') && 
      !line.startsWith('This') && 
      !line.startsWith('The') &&
      !line.startsWith('I') &&
      !line.startsWith('Note')
    );
    
    return lines.join('\n').trim();
  }

  /**
   * Format query results for use in prompts
   * @param results - Query result objects
   * @returns Formatted string representation
   */
  private formatQueryResults(results: any[]): string {
    if (!results || results.length === 0) {
      return "No results found.";
    }

    try {
      // For small result sets, use complete JSON
      if (results.length <= 10) {
        return JSON.stringify(results, null, 2);
      }
      
      // For larger result sets, include summary and sample
      const sample = results.slice(0, 5);
      return `${results.length} rows returned. Here is a sample of the first 5 rows:
      
${JSON.stringify(sample, null, 2)}`;
    } catch (error) {
      logger.error('Failed to format query results', error);
      return "Error formatting results.";
    }
  }
}

// Create and export a singleton instance
const openAIService = new OpenAIService();
export default openAIService;
