/**
 * Database Setup Script
 * 
 * Creates database, user, tables, and sample data for local development.
 */
import mysql from 'mysql2/promise';
import config from '../config';
import logger from '../services/logger.service';

// SQL to create database and user
const setupSQL = `
CREATE DATABASE IF NOT EXISTS ${config.database.database};

USE ${config.database.database};

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  query_text TEXT NOT NULL,
  user_input TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  execution_time FLOAT,
  row_count INT,
  response_status VARCHAR(20) NOT NULL,
  error_message TEXT
);

-- Insert sample data if not exists
INSERT INTO users (full_name, email, is_active, last_login)
SELECT * FROM (
    SELECT 'John Doe', 'john.doe@example.com', TRUE, '2023-10-15 14:30:22'
) AS tmp
WHERE NOT EXISTS (
    SELECT email FROM users WHERE email = 'john.doe@example.com'
) LIMIT 1;

INSERT INTO users (full_name, email, is_active, last_login)
SELECT * FROM (
    SELECT 'Jane Smith', 'jane.smith@example.com', TRUE, '2023-10-18 09:15:47'
) AS tmp
WHERE NOT EXISTS (
    SELECT email FROM users WHERE email = 'jane.smith@example.com'
) LIMIT 1;

INSERT INTO users (full_name, email, is_active, last_login)
SELECT * FROM (
    SELECT 'Michael Johnson', 'michael.j@example.com', FALSE, '2023-09-30 11:20:15'
) AS tmp
WHERE NOT EXISTS (
    SELECT email FROM users WHERE email = 'michael.j@example.com'
) LIMIT 1;

INSERT INTO users (full_name, email, is_active, last_login)
SELECT * FROM (
    SELECT 'Emily Brown', 'emily.brown@example.com', TRUE, '2023-10-19 16:45:33'
) AS tmp
WHERE NOT EXISTS (
    SELECT email FROM users WHERE email = 'emily.brown@example.com'
) LIMIT 1;

INSERT INTO users (full_name, email, is_active, last_login)
SELECT * FROM (
    SELECT 'David Wilson', 'david.wilson@example.com', TRUE, '2023-10-17 13:10:59'
) AS tmp
WHERE NOT EXISTS (
    SELECT email FROM users WHERE email = 'david.wilson@example.com'
) LIMIT 1;

-- Create view for active users
CREATE OR REPLACE VIEW active_users AS
SELECT user_id, full_name, email, created_at, last_login
FROM users
WHERE is_active = TRUE;
`;

async function setupLocalDatabase() {
  let connection;
  
  try {
    logger.info('Setting up local database...');
    
    // Connect without database name first
    connection = await mysql.createConnection({
      host: config.database.host,
      user: config.database.user,
      password: config.database.password,
      port: config.database.port,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : undefined,
      multipleStatements: true, // Allow multiple statements
    });
    
    logger.info('Connected to MySQL server, creating database and tables...');
    
    // Run setup SQL script
    await connection.query(setupSQL);
    
    logger.info('Database setup completed successfully');
    return true;
  } catch (error) {
    logger.error('Database setup failed', error);
    return false;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the function if this file is executed directly
if (require.main === module) {
  setupLocalDatabase()
    .then(success => {
      if (success) {
        logger.info('Local database setup completed successfully');
        process.exit(0);
      } else {
        logger.error('Local database setup failed');
        process.exit(1);
      }
    })
    .catch(err => {
      logger.error('Error during local database setup', err);
      process.exit(1);
    });
}

export default setupLocalDatabase;
