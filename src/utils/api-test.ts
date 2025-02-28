/**
 * API Test Utility
 * 
 * This utility tests the REST API endpoints of the RAG query system
 * by making requests to the various endpoints and displaying the results.
 */
import axios from 'axios';
import config from '../config';
import logger from '../services/logger.service';

const API_PORT = config.server.port;
const API_URL = `http://localhost:${API_PORT}`;

/**
 * Test chat endpoint
 */
async function testChatEndpoint(userQuery: string) {
  try {
    logger.info(`Testing chat endpoint with query: "${userQuery}"...`);
    
    const response = await axios.post(
      `${API_URL}/api/chat`,
      { message: userQuery },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      }
    );
    
    logger.info('Chat response received');
    
    // Display the response
    console.log('\n--- Chat Response ---');
    console.log(`AI: ${response.data.message}`);
    console.log('\nSQL:');
    console.log(response.data.sql);
    console.log('\nData:');
    console.log(response.data.data.slice(0, 3)); // Show only first 3 records
    if (response.data.data.length > 3) {
      console.log(`... and ${response.data.data.length - 3} more records`);
    }
    console.log('--------------------\n');
    
    return true;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('Chat endpoint test failed:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    } else {
      logger.error('Chat endpoint test failed:', error);
    }
    
    return false;
  }
}

/**
 * Test schema endpoint
 */
async function testSchemaEndpoint() {
  try {
    logger.info('Testing schema endpoint...');
    
    const response = await axios.get(
      `${API_URL}/api/chat/schema`,
      {
        timeout: 10000, // 10 second timeout
      }
    );
    
    logger.info('Schema response received');
    
    // Display the response
    console.log('\n--- Schema Response ---');
    console.log(`Tables: ${response.data.schema.tables.length}`);
    response.data.schema.tables.forEach((table: any) => {
      console.log(`- ${table.name} (${table.columns.length} columns)`);
    });
    console.log('------------------------\n');
    
    return true;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('Schema endpoint test failed:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    } else {
      logger.error('Schema endpoint test failed:', error);
    }
    
    return false;
  }
}

/**
 * Test raw query endpoint
 */
async function testRawQueryEndpoint(sqlQuery: string) {
  try {
    logger.info(`Testing raw query endpoint with SQL: "${sqlQuery}"...`);
    
    const response = await axios.post(
      `${API_URL}/api/chat/query`,
      { query: sqlQuery },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      }
    );
    
    logger.info('Raw query response received');
    
    // Display the response
    console.log('\n--- Raw Query Response ---');
    console.log(`Rows: ${response.data.metadata.rowCount}`);
    console.log(`Execution time: ${response.data.metadata.executionTime}s`);
    console.log('\nData:');
    console.log(response.data.results.slice(0, 3)); // Show only first 3 records
    if (response.data.results.length > 3) {
      console.log(`... and ${response.data.results.length - 3} more records`);
    }
    console.log('---------------------------\n');
    
    return true;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('Raw query endpoint test failed:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    } else {
      logger.error('Raw query endpoint test failed:', error);
    }
    
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  logger.info('Starting API tests...');
  
  let success = true;
  
  // Test schema endpoint
  const schemaSuccess = await testSchemaEndpoint();
  success = success && schemaSuccess;
  
  // Test raw query endpoint
  const rawQuerySuccess = await testRawQueryEndpoint('SELECT * FROM users LIMIT 3');
  success = success && rawQuerySuccess;
  
  // Test chat endpoint
  const chatSuccess = await testChatEndpoint('Show me all active users');
  success = success && chatSuccess;
  
  return success;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests()
    .then(success => {
      if (success) {
        logger.info('All API tests passed successfully');
        process.exit(0);
      } else {
        logger.error('Some API tests failed');
        process.exit(1);
      }
    })
    .catch(err => {
      logger.error('Error running API tests:', err);
      process.exit(1);
    });
}

export default runAllTests;
