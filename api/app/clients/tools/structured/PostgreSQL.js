const { Tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { logger } = require('@librechat/data-schemas');

/**
 * PostgreSQL Query Tool for LibreChat Agents
 * Executes SQL queries against PostgreSQL databases
 * Based on Anything LLM's SQL connector implementation
 */
class PostgreSQL extends Tool {
  static lc_name() {
    return 'PostgreSQL';
  }

  constructor(fields = {}) {
    super();
    this.name = 'PostgreSQL';
    this.description = 'Execute SQL queries against a PostgreSQL database. Use this tool to retrieve data, analyze database content, and answer questions about PostgreSQL database information. Only SELECT queries are allowed for safety.';

    // Used to initialize the Tool without necessary variables
    this.override = fields.override ?? false;

    // User-configurable fields from the UI (passed through authConfig)
    this.connectionString = fields.POSTGRES_CONNECTION_STRING;
    this.host = fields.POSTGRES_HOST;
    this.port = fields.POSTGRES_PORT || '5432';
    this.database = fields.POSTGRES_DATABASE;
    this.username = fields.POSTGRES_USERNAME;
    this.password = fields.POSTGRES_PASSWORD;
    this.schema = fields.POSTGRES_SCHEMA || 'public';
    this.ssl = fields.POSTGRES_SSL === 'true' || fields.POSTGRES_SSL === true;
    
    // Query limits for safety
    this.maxRows = parseInt(fields.POSTGRES_MAX_ROWS || '100');
    this.queryTimeout = parseInt(fields.POSTGRES_QUERY_TIMEOUT || '30000');

    // Schema for the tool input
    this.schema = z.object({
      query: z.string().describe('The PostgreSQL query to execute. Should be a SELECT statement for data retrieval. Avoid DROP, DELETE, UPDATE, INSERT operations for safety.'),
      limit: z.number().optional().describe('Optional limit for number of rows to return (default: 100, max: 1000)'),
    });

    // Build connection string if not provided
    if (!this.connectionString && !this.override) {
      this.connectionString = this._buildConnectionString();
    }

    // Validate required fields (unless in override mode)
    if (!this.override) {
      if (!this.connectionString && (!this.host || !this.database || !this.username || !this.password)) {
        throw new Error(
          'Missing PostgreSQL connection details. Please provide either a connection string or individual connection parameters (host, database, username, password).'
        );
      }
    }

    // Initialize database client
    if (!this.override) {
      this._initializeClient();
    }
  }

  // Build connection string from individual parameters
  _buildConnectionString() {
    if (!this.host || !this.database || !this.username || !this.password) {
      return null;
    }

    const sslParam = this.ssl ? '?sslmode=require' : '';
    return `postgresql://${this.username}:${this.password}@${this.host}:${this.port}/${this.database}${sslParam}`;
  }

  // Initialize PostgreSQL client
  _initializeClient() {
    try {
      const { Pool } = require('pg');
      
      let config;
      if (this.connectionString) {
        config = {
          connectionString: this.connectionString,
          ssl: this.ssl ? { rejectUnauthorized: false } : false,
          max: 5,
          idleTimeoutMillis: this.queryTimeout,
          connectionTimeoutMillis: this.queryTimeout,
        };
      } else {
        config = {
          host: this.host,
          port: this.port,
          database: this.database,
          user: this.username,
          password: this.password,
          ssl: this.ssl ? { rejectUnauthorized: false } : false,
          max: 5,
          idleTimeoutMillis: this.queryTimeout,
          connectionTimeoutMillis: this.queryTimeout,
        };
      }

      this.pool = new Pool(config);
      
      // Test connection
      this.pool.query('SELECT 1').catch((error) => {
        logger.error('PostgreSQL connection test failed:', error);
      });
      
    } catch (error) {
      logger.error('Failed to initialize PostgreSQL client:', error);
      throw new Error('Failed to initialize PostgreSQL client. Make sure pg package is installed.');
    }
  }

  // Validate query for safety
  _validateQuery(query) {
    const trimmedQuery = query.trim().toLowerCase();
    
    // Allow only SELECT queries and some utility functions
    const allowedQueries = ['select', 'show', 'describe', 'explain', 'with'];
    const disallowedQueries = ['insert', 'update', 'delete', 'drop', 'create', 'alter', 'truncate'];
    
    const startsWithAllowed = allowedQueries.some(allowed => trimmedQuery.startsWith(allowed));
    const containsDisallowed = disallowedQueries.some(disallowed => trimmedQuery.includes(disallowed));
    
    if (!startsWithAllowed || containsDisallowed) {
      throw new Error('Only SELECT queries and schema inspection commands are allowed for safety reasons.');
    }
  }

  // Execute the SQL query
  async _call(input) {
    if (this.override) {
      return 'PostgreSQL tool is not configured.';
    }

    const query = input.query;
    const limit = Math.min(input.limit || this.maxRows, 1000);

    try {
      logger.info(`PostgreSQL executing query: ${query.substring(0, 100)}...`);
      
      this._validateQuery(query);
      
      // Add LIMIT clause if not present and it's a SELECT query
      let finalQuery = query;
      if (query.trim().toLowerCase().startsWith('select') && 
          !query.toLowerCase().includes('limit') && 
          limit > 0) {
        finalQuery = `${query} LIMIT ${limit}`;
      }
      
      const result = await this.pool.query(finalQuery);
      return this._formatResults(result, finalQuery);
      
    } catch (error) {
      logger.error('PostgreSQL query error:', error);
      
      if (error.message.includes('permission denied') || error.message.includes('access denied')) {
        return `Access denied: ${error.message}. Please check your database permissions.`;
      }
      
      if (error.message.includes('does not exist')) {
        return `Database object not found: ${error.message}. Please verify the table/column names.`;
      }
      
      return `Query execution failed: ${error.message}`;
    }
  }

  // Format query results for agent consumption
  _formatResults(result, query) {
    const { rows, rowCount } = result;
    
    if (rowCount === 0) {
      return 'Query executed successfully but returned no results.';
    }

    // For large result sets, provide summary
    if (rows.length > 50) {
      const sample = rows.slice(0, 10);
      return `Query returned ${rowCount} rows. Here's a sample of the first 10 rows:\n\n` +
             `Columns: ${Object.keys(sample[0]).join(', ')}\n\n` +
             JSON.stringify(sample, null, 2) +
             `\n\n... and ${rowCount - 10} more rows.`;
    }

    return `Query returned ${rowCount} rows:\n\n` +
           `Columns: ${Object.keys(rows[0] || {}).join(', ')}\n\n` +
           JSON.stringify(rows, null, 2);
  }

  // Get database schema information
  async getSchema() {
    if (this.override) {
      return 'PostgreSQL tool is not configured.';
    }

    try {
      const schemaQuery = `
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_schema = $1
        ORDER BY table_name, ordinal_position
      `;
      
      const result = await this.pool.query(schemaQuery, [this.schema]);
      return this._formatSchemaResults(result.rows);
      
    } catch (error) {
      logger.error('Error getting PostgreSQL schema:', error);
      return `Error retrieving schema: ${error.message}`;
    }
  }

  // Format schema results
  _formatSchemaResults(rows) {
    if (!rows.length) {
      return 'No tables found in the specified schema.';
    }

    const tables = {};
    rows.forEach(row => {
      if (!tables[row.table_name]) {
        tables[row.table_name] = [];
      }
      tables[row.table_name].push({
        column: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        default: row.column_default
      });
    });

    let schemaInfo = 'Database Schema:\n\n';
    Object.entries(tables).forEach(([tableName, columns]) => {
      schemaInfo += `Table: ${tableName}\n`;
      columns.forEach(col => {
        schemaInfo += `  - ${col.column} (${col.type})${col.nullable ? ' NULL' : ' NOT NULL'}${col.default ? ` DEFAULT ${col.default}` : ''}\n`;
      });
      schemaInfo += '\n';
    });

    return schemaInfo;
  }

  // Cleanup resources
  async cleanup() {
    if (this.pool) {
      try {
        await this.pool.end();
        logger.info('PostgreSQL connection pool closed');
      } catch (error) {
        logger.error('Error closing PostgreSQL pool:', error);
      }
    }
  }
}

module.exports = PostgreSQL;
