/**
 * Main Application Entry Point
 * 
 * Sets up the Express server with middleware, routes, and error handling.
 * Initializes required services and establishes database connections.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import config from './config';
import logger from './services/logger.service';
import { notFoundMiddleware, errorHandlerMiddleware } from './middleware/error.middleware';
import chatRoutes from './routes/chat.routes';
import databaseService from './services/database.service';
import schemaService from './services/schema.service';
import openAIService from './services/openai.service';
import n8nService from './services/n8n.service';

// Create Express application
const app = express();

// Apply middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
})); // Security headers
app.use(cors()); // CORS support
app.use(express.json()); // Parse JSON bodies
app.use(express.static('public')); // Serve static files from public directory

// Redirect root to the new chat interface
app.get('/', (req, res) => {
  res.redirect('/chat.html');
});

// Add request ID middleware
app.use((req, res, next) => {
  const requestId = uuidv4();
  res.setHeader('X-Request-ID', requestId);
  req.headers['x-request-id'] = requestId;
  next();
});

// Add request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    requestId: req.headers['x-request-id'],
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  next();
});

// API routes
app.use('/api/chat', chatRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv,
  });
});

// Service diagnostics endpoint
app.get('/diagnostics', async (req, res) => {
  const results = {
    server: { status: 'ok', message: 'Server is running' },
    database: { status: 'unknown', message: 'Not tested yet' },
    schema: { status: 'unknown', message: 'Not tested yet' },
    openai: { status: 'unknown', message: 'Not tested yet' },
    n8n: { status: 'unknown', message: 'Not tested yet' },
  };
  
  // Test database
  try {
    await databaseService.testConnection();
    results.database = { status: 'ok', message: 'Database connection successful' };
  } catch (error) {
    results.database = { 
      status: 'error', 
      message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
  
  // Test schema service
  try {
    const schema = await schemaService.getSchema();
    const tableCount = schema.tables.length;
    results.schema = { status: 'ok', message: `Schema service found ${tableCount} tables` };
  } catch (error) {
    results.schema = { 
      status: 'error', 
      message: `Schema service failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
  
  // Test OpenAI
  try {
    // Just test if it's initialized
    if (openAIService.isInitialized()) {
      results.openai = { status: 'ok', message: 'OpenAI service is initialized' };
    } else {
      throw new Error('OpenAI service is not initialized');
    }
  } catch (error) {
    results.openai = { 
      status: 'error', 
      message: `OpenAI service check failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
  
  // Test n8n
  try {
    await n8nService.testConnection();
    results.n8n = { status: 'ok', message: 'n8n connection successful' };
  } catch (error) {
    results.n8n = { 
      status: 'error', 
      message: `n8n connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
  
  res.status(200).json({
    timestamp: new Date().toISOString(),
    services: results
  });
});

// Apply error handling middleware
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

// Initialize services and start server
async function startServer() {
  try {
    logger.info('Starting server initialization...');
    
    // Initialize database connection with timeout
    logger.info('Initializing database connection...');
    try {
      await Promise.race([
        databaseService.initialize(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Database connection timeout after 10 seconds')), 10000))
      ]);
      logger.info('Database connection initialized successfully');
    } catch (dbError) {
      logger.error(`Database initialization failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`, dbError);
      throw new Error(`Database initialization failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
    }
    
    // Pre-fetch database schema
    logger.info('Refreshing database schema...');
    try {
      await schemaService.refreshSchema();
      logger.info('Database schema refreshed successfully');
    } catch (schemaError) {
      logger.error(`Schema refresh failed: ${schemaError instanceof Error ? schemaError.message : 'Unknown error'}`, schemaError);
      throw new Error(`Schema refresh failed: ${schemaError instanceof Error ? schemaError.message : 'Unknown error'}`);
    }
    
    // Initialize OpenAI service
    logger.info('Initializing OpenAI service...');
    try {
      await openAIService.initialize();
      logger.info('OpenAI service initialized successfully');
    } catch (openaiError) {
      logger.error(`OpenAI initialization failed: ${openaiError instanceof Error ? openaiError.message : 'Unknown error'}`, openaiError);
      throw new Error(`OpenAI initialization failed: ${openaiError instanceof Error ? openaiError.message : 'Unknown error'}`);
    }
    
    // Test n8n connection
    logger.info('Testing n8n connection...');
    try {
      await n8nService.testConnection();
      logger.info('n8n connection test successful');
    } catch (n8nError) {
      logger.error(`n8n connection test failed: ${n8nError instanceof Error ? n8nError.message : 'Unknown error'}`, n8nError);
      // Don't throw an error here, just log the warning and continue
      // This allows the server to start even if n8n has issues
      logger.warn('Continuing server startup despite n8n connection issues. Some database query features may not work correctly.');
    }
    
    // Start server
    app.listen(config.server.port, () => {
      logger.info(`Server running in ${config.server.nodeEnv} mode on port ${config.server.port}`);
      logger.info('All services initialized successfully');
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    
    // Wait a moment before exiting to ensure logs are written
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received. Shutting down gracefully');
  await databaseService.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received. Shutting down gracefully');
  await databaseService.close();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
  process.exit(1);
});

// Start the server
startServer();

export default app;
