/**
 * Database Connection Test Utility
 * 
 * This utility tests the connection to the database and verifies
 * that the required tables exist.
 */
import mysql from 'mysql2/promise';
import config from '../config';
import logger from '../services/logger.service';

/**
 * Tests the database connection and schema
 */
async function testDatabaseConnection() {
  let connection;
  
  try {
    logger.info('Attempting to connect to the database...');
    
    // Create connection
    connection = await mysql.createConnection({
      host: config.database.host,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      port: config.database.port,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : undefined,
    });
    
    logger.info('Successfully connected to the database');
    
    // Test database by checking for required tables
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE() 
       AND TABLE_NAME IN ('users', 'audit_logs')`
    );
    
    // Check if both tables exist
    const tableArray = tables as any[];
    const tableNames = tableArray.map(row => row.TABLE_NAME);
    
    if (tableNames.includes('users') && tableNames.includes('audit_logs')) {
      logger.info('Required tables found: users, audit_logs');
    } else {
      const missingTables = [];
      if (!tableNames.includes('users')) missingTables.push('users');
      if (!tableNames.includes('audit_logs')) missingTables.push('audit_logs');
      
      logger.warn(`Missing required tables: ${missingTables.join(', ')}`);
      logger.warn('Please run the database setup script from the db directory');
    }
    
    // Check for sample data
    const [userCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
    logger.info(`Found ${(userCount as any[])[0].count} users in database`);
    
    return true;
  } catch (error) {
    logger.error('Failed to connect to the database:', error);
    return false;
  } finally {
    if (connection) {
      await connection.end();
      logger.info('Database connection closed');
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testDatabaseConnection()
    .then(success => {
      if (success) {
        logger.info('Database connectivity test passed');
        process.exit(0);
      } else {
        logger.error('Database connectivity test failed');
        process.exit(1);
      }
    })
    .catch(err => {
      logger.error('Error during database test:', err);
      process.exit(1);
    });
}

export default testDatabaseConnection;
