/**
 * Schema Service
 * 
 * Provides database schema discovery and caching capabilities.
 * This service introspects any connected database to build a metadata
 * model that helps guide SQL generation.
 */
import databaseService from './database.service';
import logger from './logger.service';
import { DatabaseSchema, TableMetadata, ColumnMetadata, Relationship } from '../types';

class SchemaService {
  private schema: DatabaseSchema | null = null;
  private lastRefreshTime: number = 0;
  private refreshIntervalMs: number = 3600000; // 1 hour

  /**
   * Get database schema, refreshing if needed
   */
  public async getSchema(forceRefresh: boolean = false): Promise<DatabaseSchema> {
    const currentTime = Date.now();
    
    // Refresh if schema is null, forced, or cache expired
    if (
      this.schema === null || 
      forceRefresh || 
      currentTime - this.lastRefreshTime > this.refreshIntervalMs
    ) {
      await this.refreshSchema();
    }
    
    return this.schema as DatabaseSchema;
  }

  /**
   * Refreshes database schema information
   */
  public async refreshSchema(): Promise<void> {
    try {
      logger.info('Refreshing database schema...');
      
      // Get list of tables
      const tables = await this.getTables();
      
      // Build schema object with table and column metadata
      const schema: DatabaseSchema = {
        tables: [],
      };

      // For each table, get column information and relationships
      for (const tableName of tables) {
        const columns = await this.getColumns(tableName);
        const relationships = await this.getRelationships(tableName);
        
        const primaryKeyColumn = columns.find(col => col.isPrimaryKey);
        
        schema.tables.push({
          name: tableName,
          columns,
          primaryKey: primaryKeyColumn?.name,
          relationships,
        });
      }
      
      // Update schema and refresh time
      this.schema = schema;
      this.lastRefreshTime = Date.now();
      
      logger.info(`Schema refreshed: ${schema.tables.length} tables discovered`);
    } catch (error) {
      logger.error('Failed to refresh schema', error);
      throw new Error('Schema discovery failed');
    }
  }

  /**
   * Gets a list of all tables in the database
   */
  private async getTables(): Promise<string[]> {
    try {
      const tablesResult = await databaseService.query<{ TABLE_NAME: string }[]>(
        `SELECT TABLE_NAME FROM information_schema.tables 
         WHERE table_schema = DATABASE() 
         AND table_type = 'BASE TABLE'`
      );
      
      return tablesResult.map(row => row.TABLE_NAME);
    } catch (error) {
      logger.error('Failed to retrieve table list', error);
      throw error;
    }
  }

  /**
   * Gets column metadata for a specific table
   * @param tableName - Name of the table
   */
  private async getColumns(tableName: string): Promise<ColumnMetadata[]> {
    try {
      const columnsResult = await databaseService.query<any[]>(
        `SELECT 
           COLUMN_NAME, 
           DATA_TYPE, 
           IS_NULLABLE, 
           COLUMN_KEY, 
           COLUMN_DEFAULT,
           EXTRA
         FROM information_schema.columns 
         WHERE table_schema = DATABASE() 
         AND table_name = ?
         ORDER BY ORDINAL_POSITION`,
        [tableName]
      );
      
      return columnsResult.map(col => ({
        name: col.COLUMN_NAME,
        dataType: col.DATA_TYPE,
        isNullable: col.IS_NULLABLE === 'YES',
        isPrimaryKey: col.COLUMN_KEY === 'PRI',
        isForeignKey: col.COLUMN_KEY === 'MUL',
        defaultValue: col.COLUMN_DEFAULT,
      }));
    } catch (error) {
      logger.error(`Failed to retrieve columns for table: ${tableName}`, error);
      throw error;
    }
  }

  /**
   * Gets foreign key relationships for a specific table
   * @param tableName - Name of the table
   */
  private async getRelationships(tableName: string): Promise<Relationship[]> {
    try {
      const relationshipsResult = await databaseService.query<any[]>(
        `SELECT
           COLUMN_NAME,
           REFERENCED_TABLE_NAME,
           REFERENCED_COLUMN_NAME
         FROM information_schema.key_column_usage
         WHERE table_schema = DATABASE()
         AND table_name = ?
         AND referenced_table_name IS NOT NULL`,
        [tableName]
      );
      
      return relationshipsResult.map(rel => ({
        columnName: rel.COLUMN_NAME,
        referencedTable: rel.REFERENCED_TABLE_NAME,
        referencedColumn: rel.REFERENCED_COLUMN_NAME,
      }));
    } catch (error) {
      logger.error(`Failed to retrieve relationships for table: ${tableName}`, error);
      throw error;
    }
  }

  /**
   * Gets a formatted schema description string suitable for LLM prompts
   */
  public getSchemaDescription(schema: DatabaseSchema): string {
    let description = 'Database Schema:\n\n';
    
    for (const table of schema.tables) {
      description += `Table: ${table.name}\n`;
      description += 'Columns:\n';
      
      for (const column of table.columns) {
        const constraints: string[] = [];
        
        if (column.isPrimaryKey) constraints.push('PRIMARY KEY');
        if (column.isForeignKey) constraints.push('FOREIGN KEY');
        if (!column.isNullable) constraints.push('NOT NULL');
        
        const constraintStr = constraints.length > 0 
          ? ` (${constraints.join(', ')})` 
          : '';
        
        description += `  - ${column.name}: ${column.dataType}${constraintStr}\n`;
      }
      
      if (table.relationships.length > 0) {
        description += 'Relationships:\n';
        for (const rel of table.relationships) {
          description += `  - ${rel.columnName} references ${rel.referencedTable}(${rel.referencedColumn})\n`;
        }
      }
      
      description += '\n';
    }
    
    return description;
  }
}

// Create and export a singleton instance
const schemaService = new SchemaService();
export default schemaService;
