/**
 * n8n Connection Test Utility
 * 
 * This utility tests the connection to the n8n webhook and verifies
 * that it is properly set up to execute SQL queries.
 */
import axios from 'axios';
import config from '../config';
import logger from '../services/logger.service';

/**
 * Tests the n8n webhook connection
 */
async function testN8nWebhook() {
  try {
    logger.info('Testing n8n webhook connection...');
    
    // Test query to execute
    const testQuery = 'SELECT 1 as test';
    
    // Call the webhook
    const response = await axios.post(
      config.n8n.webhookUrl,
      { query: testQuery },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      }
    );
    
    // Check response structure
    if (!response.data || !Array.isArray(response.data.results)) {
      logger.error('Invalid response format from n8n:', response.data);
      return false;
    }
    
    logger.info('Successfully connected to n8n webhook');
    logger.info(`Response: ${JSON.stringify(response.data)}`);
    
    return true;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('Failed to connect to n8n webhook:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    } else {
      logger.error('Failed to connect to n8n webhook:', error);
    }
    
    logger.warn('Please ensure n8n is running and the webhook is properly configured');
    logger.warn('n8n webhook URL: ' + config.n8n.webhookUrl);
    
    return false;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testN8nWebhook()
    .then(success => {
      if (success) {
        logger.info('n8n webhook test passed');
        process.exit(0);
      } else {
        logger.error('n8n webhook test failed');
        process.exit(1);
      }
    })
    .catch(err => {
      logger.error('Error during n8n test:', err);
      process.exit(1);
    });
}

export default testN8nWebhook;
