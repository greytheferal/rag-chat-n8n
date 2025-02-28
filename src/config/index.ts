/**
 * Application Configuration
 * 
 * This module loads and provides access to all environment-specific configuration
 * using dotenv. It centralizes configuration management and provides type safety
 * through explicit interface definition.
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Configuration interface defining all application settings
 */
interface Config {
  server: {
    port: number;
    nodeEnv: string;
  };
  database: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number;
    ssl: boolean;
  };
  n8n: {
    webhookUrl: string;
  };
  openai: {
    apiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  logging: {
    level: string;
    directory: string;
  };
}

/**
 * Application configuration object with all settings
 */
const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'rag_test_db',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    ssl: process.env.DB_SSL === 'true',
  },
  n8n: {
    webhookUrl: process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/execute-query',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4',
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    directory: process.env.LOG_DIRECTORY || 'logs',
  },
};

// Create log directory if it doesn't exist
if (!fs.existsSync(config.logging.directory)) {
  fs.mkdirSync(config.logging.directory, { recursive: true });
}

export default config;
