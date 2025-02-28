/**
 * Database Table Creation Utility
 * 
 * This utility creates the necessary tables in the database for the RAG query system.
 * It's meant to be run once during initial setup or when resetting the database.
 */
import databaseService from '../services/database.service';
import logger from '../services/logger.service';

/**
 * Creates tables in the database
 */
async function createTables() {
  try {
    logger.info('Creating database tables...');
    
    // Create users table if it doesn't exist
    await databaseService.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP NULL
      )
    `);
    
    // Create audit_logs table if it doesn't exist
    await databaseService.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        log_id INT AUTO_INCREMENT PRIMARY KEY,
        query_text TEXT NOT NULL,
        user_input TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        execution_time FLOAT,
        row_count INT,
        response_status VARCHAR(20) NOT NULL,
        error_message TEXT
      )
    `);
    
    // Check if users table has data, if not insert sample data
    const userCount = await databaseService.query<{ count: number }[]>('SELECT COUNT(*) as count FROM users');
    
    if (userCount[0].count === 0) {
      logger.info('Inserting sample data into users table...');
      
      // Insert sample data
      await databaseService.query(`
        INSERT INTO users (full_name, email, is_active, last_login) VALUES
        ('John Doe', 'john.doe@example.com', TRUE, '2023-10-15 14:30:22'),
        ('Jane Smith', 'jane.smith@example.com', TRUE, '2023-10-18 09:15:47'),
        ('Michael Johnson', 'michael.j@example.com', FALSE, '2023-09-30 11:20:15'),
        ('Emily Brown', 'emily.brown@example.com', TRUE, '2023-10-19 16:45:33'),
        ('David Wilson', 'david.wilson@example.com', TRUE, '2023-10-17 13:10:59'),
        ('Sarah Davis', 'sarah.davis@example.com', TRUE, '2023-10-16 10:22:41'),
        ('Robert Miller', 'robert.miller@example.com', FALSE, '2023-09-25 08:05:19'),
        ('Jennifer Garcia', 'jennifer.g@example.com', TRUE, '2023-10-20 11:37:28'),
        ('William Martinez', 'william.m@example.com', TRUE, '2023-10-18 15:42:16'),
        ('Elizabeth Taylor', 'elizabeth.t@example.com', TRUE, '2023-10-19 13:25:37')
      `);
    }
    
    // Create active_users view
    await databaseService.query(`
      CREATE OR REPLACE VIEW active_users AS
      SELECT user_id, full_name, email, created_at, last_login
      FROM users
      WHERE is_active = TRUE
    `);
    
    logger.info('Database tables and sample data created successfully');
    return true;
  } catch (error) {
    logger.error('Failed to create database tables', error);
    throw error;
  }
}

// Run the function if this file is executed directly
if (require.main === module) {
  // Initialize database connection
  databaseService.initialize()
    .then(() => createTables())
    .then(() => {
      logger.info('Database setup completed successfully');
      process.exit(0);
    })
    .catch(err => {
      logger.error('Database setup failed', err);
      process.exit(1);
    });
}

export default createTables;
