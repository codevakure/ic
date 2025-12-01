const { Tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { logger } = require('@librechat/data-schemas');

/**
 * Snowflake Database Query Tool for LibreChat Agents
 * Executes SQL queries against Snowflake data warehouse
 * Provides secure, read-only access to Snowflake databases
 */
class SnowflakeDatabase extends Tool {
  static lc_name() {
    return 'SnowflakeDatabase';
  }

  constructor(fields = {}) {
    super();
    this.name = 'SnowflakeDatabase';
    this.description = 'Execute SQL queries against a Snowflake data warehouse. Use this tool to retrieve data, analyze warehouse content, and answer questions about Snowflake database information. Only SELECT queries are allowed for safety. Requires valid warehouse, database, and role permissions in Snowflake.';

    // Used to initialize the Tool without necessary variables
    this.override = fields.override ?? false;

    // Define schema for the tool input
    this.schema = z.object({
      query: z.string().describe(
        'SQL query to execute against the Snowflake database. Only SELECT queries are allowed for security. ' +
        'Include proper Snowflake-specific syntax like database.schema.table naming when needed.'
      ),
    });

    // User-configurable fields from the UI (passed through authConfig)
    this.account = fields.SNOWFLAKE_ACCOUNT;
    this.username = fields.SNOWFLAKE_USERNAME;
    this.password = fields.SNOWFLAKE_PASSWORD;
    this.warehouse = fields.SNOWFLAKE_WAREHOUSE;
    this.database = fields.SNOWFLAKE_DATABASE && fields.SNOWFLAKE_DATABASE.trim() ? fields.SNOWFLAKE_DATABASE.trim() : undefined;
    this.schemaName = fields.SNOWFLAKE_SCHEMA || 'PUBLIC';
    this.role = fields.SNOWFLAKE_ROLE;

    // Optional configuration
    this.maxRows = parseInt(fields.SNOWFLAKE_MAX_ROWS || '100', 10);
    this.queryTimeout = parseInt(fields.SNOWFLAKE_QUERY_TIMEOUT || '30000', 10);
    
    // Connection state
    this.connection = null;
    this.isConnected = false;

    // Validate required fields unless in override mode
    if (!this.override) {
      this._validateConfiguration();
      this._initializeClient();
    }
  }

  _validateConfiguration() {
    const missingFields = [];

    if (!this.account) {
      missingFields.push('Snowflake Account');
    }

    if (!this.username) {
      missingFields.push('Snowflake Username');
    }

    if (!this.password) {
      missingFields.push('Snowflake Password');
    }

    if (!this.warehouse) {
      missingFields.push('Snowflake Warehouse');
    }

    if (!this.role) {
      missingFields.push('Snowflake Role');
    }

    if (missingFields.length > 0) {
      throw new Error(
        `Snowflake Database tool is missing required configuration: ${missingFields.join(', ')}. ` +
        'Please provide these values in the tool configuration.'
      );
    }
  }

  // Initialize Snowflake client (only creates the config, doesn't connect yet)
  _initializeClient() {
    try {
      this.snowflake = require('snowflake-sdk');
      
      this.config = {
        account: this.account,
        username: this.username,
        password: this.password,
        warehouse: this.warehouse,
        schema: this.schemaName,
        role: this.role,
        // Connection pool settings
        connectTimeout: this.queryTimeout,
        networkTimeout: this.queryTimeout,
        // Performance settings
        clientSessionKeepAlive: true,
        clientSessionKeepAliveHeartbeatFrequency: 3600, // 1 hour
      };

      // Only include database if it's provided
      if (this.database) {
        this.config.database = this.database;
      }

      // Don't create connection here - do it lazily in _connect()
      this.connection = null;
      this.isConnected = false;
      
      logger.info('Snowflake client configuration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Snowflake client:', error);
      throw new Error('Failed to initialize Snowflake client. Make sure snowflake-sdk package is installed and configuration is correct.');
    }
  }

  // Validate query for safety
  _validateQuery(query) {
    const trimmedQuery = query.trim().toLowerCase();
    
    // Allow only SELECT queries and some utility functions
    const allowedQueries = ['select', 'show', 'describe', 'explain', 'with', 'use'];
    const disallowedQueries = ['insert', 'update', 'delete', 'drop', 'create', 'alter', 'truncate', 'merge', 'copy'];
    
    const startsWithAllowed = allowedQueries.some(allowed => {
      const starts = trimmedQuery.startsWith(allowed);
      return starts;
    });
    
    const containsDisallowed = disallowedQueries.some(disallowed => {
      // Use word boundaries to avoid false positives (e.g., CAST function vs CREATE statement)
      const regex = new RegExp(`\\b${disallowed}\\b`, 'i');
      
      // Remove string literals to avoid false positives from content within quotes
      const queryWithoutStrings = trimmedQuery.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');
      
      const contains = regex.test(queryWithoutStrings);
      if (contains) {
        logger.info(`[SnowflakeDatabase] Query contains disallowed word '${disallowed}': ${contains}`);
      }
      return contains;
    });
    
    logger.info(`[SnowflakeDatabase] Validation result - startsWithAllowed: ${startsWithAllowed}, containsDisallowed: ${containsDisallowed}`);
    
    if (!startsWithAllowed || containsDisallowed) {
      throw new Error('Only SELECT queries and schema inspection commands are allowed for safety reasons.');
    }

    // Additional Snowflake-specific validations
    if (trimmedQuery.includes('$') && !trimmedQuery.includes('current_')) {
      throw new Error('System functions and variables are not allowed for security reasons.');
    }
  }

  // Connect to Snowflake with error handling and connection reuse
  // Note: This method is now only used for health checks, actual connection
  // happens inline in _call() method to match working standalone pattern

  // Execute the SQL query
  async _call(input) {
    return new Promise((resolve, reject) => {
      try {
        // logger.info(`[SnowflakeDatabase] _call method invoked with input:`, JSON.stringify(input, null, 2));
        
        const { query } = input;
      
        
        if (!query || typeof query !== 'string') {
          const error = 'Query is required and must be a string';
          logger.error(`[SnowflakeDatabase] Input validation failed: ${error}`);
          return reject(new Error(error));
        }

        // Normalize query to handle multiline formatting
        const normalizedQuery = query.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

        this._validateQuery(normalizedQuery);


        const connection = this.snowflake.createConnection(this.config);
        
        // Set a timeout for the entire operation
        const operationTimeout = setTimeout(() => {
          logger.error('[SnowflakeDatabase] Entire operation timed out');
          reject(new Error(`Operation timed out after ${this.queryTimeout}ms`));
        }, this.queryTimeout);

        connection.connect((err, conn) => {
          
          if (err) {
            clearTimeout(operationTimeout);
            logger.error('[SnowflakeDatabase] Connection failed:', err);
            return reject(new Error(`Connection failed: ${err.message}`));
          }
          
          conn.execute({
            sqlText: 'SELECT CURRENT_WAREHOUSE(), CURRENT_DATABASE(), CURRENT_ROLE(), CURRENT_USER()',
            complete: (contextErr, contextStmt, contextRows) => {
              if (contextErr) {
                logger.error('[SnowflakeDatabase] Failed to get session context:', contextErr);
              } else {
                if (contextRows && contextRows.length > 0) {
                  const context = contextRows[0];
                } else {
                  logger.info('  No context data returned');
                }
              }
              
              // Check available warehouses
              conn.execute({
                sqlText: 'SHOW WAREHOUSES',
                complete: (warehouseListErr, warehouseListStmt, warehouseListRows) => {
                  if (warehouseListErr) {
                    logger.error('[SnowflakeDatabase] Failed to list warehouses:', warehouseListErr);
                  } else {
                    if (warehouseListRows && warehouseListRows.length > 0) {
                      const warehouses = warehouseListRows.slice(0, 10).map(w => ({
                        name: w.name || w.NAME,
                        size: w.size || w.SIZE,
                        state: w.state || w.STATE
                      }));
                    } else {
                      logger.info('No warehouses found or no access permissions');
                    }
                  }
                  
                  // Try to set the warehouse from config
                  const useWarehouseSQL = `USE WAREHOUSE ${this.warehouse}`;
                  
                  conn.execute({
                    sqlText: useWarehouseSQL,
                    complete: (warehouseErr, warehouseStmt, warehouseRows) => {
                      if (warehouseErr) {
                        clearTimeout(operationTimeout);
                        
                        // Provide helpful error message with available warehouses
                        let errorMsg = `Failed to activate warehouse "${this.warehouse}": ${warehouseErr.message}.`;
                        if (warehouseListRows && warehouseListRows.length > 0) {
                          const availableWarehouses = warehouseListRows
                            .map(w => w.name || w.NAME)
                            .filter(Boolean)
                            .slice(0, 5);
                          if (availableWarehouses.length > 0) {
                            errorMsg += `\n\nAvailable warehouses:\n${availableWarehouses.map(w => `  - ${w}`).join('\n')}`;
                            errorMsg += `\n\nTo fix this issue:\n1. Update your Snowflake configuration to use one of the available warehouses\n2. Or request access to the "${this.warehouse}" warehouse from your Snowflake administrator`;
                          } else {
                            errorMsg += ' No warehouses found. You may not have access to any warehouses.';
                          }
                        } else {
                          errorMsg += ' Could not retrieve warehouse list. Please check permissions.';
                        }
                        errorMsg += '\n\nPlease verify warehouse name and permissions.';
                        
                        return reject(new Error(errorMsg));
                      }
                    
                      
                      // Now execute the main query
                      conn.execute({
                        sqlText: normalizedQuery,
                        complete: (queryErr, stmt, rows) => {
              clearTimeout(operationTimeout);
              
              if (queryErr) {
                logger.error('[SnowflakeDatabase] Query execution failed:', queryErr);
                return reject(new Error(`Query failed: ${queryErr.message}`));
              }

              
                          try {
                            const formattedResults = this._formatResults({ stmt, rows }, normalizedQuery);
                            resolve(formattedResults);
                          } catch (formatError) {
                            reject(new Error(`Error formatting results: ${formatError.message}`));
                          }
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        });
        
      } catch (error) {
        reject(new Error(`Error executing Snowflake query: ${error.message}`));
      }
    });
  }



  // Format query results for agent consumption
  _formatResults(result, query) {
    const { rows } = result;
    
    if (!rows || rows.length === 0) {
      return 'Query executed successfully but returned no results.';
    }

    // Limit rows for performance
    const limitedRows = rows.slice(0, this.maxRows);
    const wasLimited = rows.length > this.maxRows;

    try {
      // Format as a readable table for the agent
      const headers = Object.keys(limitedRows[0]);
      let formattedResult = `Query Results (${limitedRows.length} row${limitedRows.length !== 1 ? 's' : ''}):\n\n`;
      
      // Add headers
      formattedResult += headers.join(' | ') + '\n';
      formattedResult += headers.map(() => '---').join(' | ') + '\n';
      
      // Add data rows
      limitedRows.forEach(row => {
        const values = headers.map(header => {
          const value = row[header];
          return value === null ? 'NULL' : String(value);
        });
        formattedResult += values.join(' | ') + '\n';
      });

      if (wasLimited) {
        formattedResult += `\n(Results limited to ${this.maxRows} rows. Total rows: ${rows.length})`;
      }

      return formattedResult;
    } catch (formatError) {
      logger.error('Error formatting Snowflake results:', formatError);
      return `Query executed successfully and returned ${rows.length} rows, but there was an error formatting the results.`;
    }
  }

  // Get database schema information
  async getSchema() {
    try {
      let query;
      if (this.database) {
        query = `SHOW TABLES IN DATABASE "${this.database}"`;
      } else {
        query = `SHOW TABLES`;
      }
      
      const result = await this._call({ query });
      return result;
    } catch (error) {
      logger.error('Error fetching Snowflake schema:', error);
      return `Error fetching schema: ${error.message}`;
    }
  }

  // Get table information
  async getTableInfo(tableName) {
    try {
      let query;
      if (this.database) {
        query = `DESCRIBE TABLE "${this.database}"."${this.schemaName}"."${tableName}"`;
      } else {
        query = `DESCRIBE TABLE "${this.schemaName}"."${tableName}"`;
      }
      
      const result = await this._call({ query });
      return result;
    } catch (error) {
      logger.error(`Error fetching table info for ${tableName}:`, error);
      return `Error fetching table information: ${error.message}`;
    }
  }

  // Check if connection is healthy (simplified since we create fresh connections)
  _isConnectionHealthy() {
    // Always return false to create fresh connections (simpler and more reliable)
    return false;
  }

  // Cleanup resources
  async cleanup() {
    if (this.connection) {
      try {
        await new Promise((resolve, reject) => {
          this.connection.destroy((err) => {
            if (err) {
              logger.error('Error closing Snowflake connection:', err);
              return reject(err);
            }
            logger.info('Snowflake connection closed successfully');
            resolve();
          });
        });
      } catch (error) {
        logger.error('Failed to cleanup Snowflake connection:', error);
      } finally {
        this.isConnected = false;
        this.connection = null;
      }
    }
  }

  // Static method to get tool metadata
  static getToolInfo() {
    return {
      name: 'SnowflakeDatabase',
      description: 'Execute SQL queries against Snowflake data warehouse',
      category: 'Database',
      requiresAuth: true,
      authFields: [
        'SNOWFLAKE_ACCOUNT',
        'SNOWFLAKE_USERNAME', 
        'SNOWFLAKE_PASSWORD',
        'SNOWFLAKE_WAREHOUSE'
      ],
      optionalFields: [
        'SNOWFLAKE_SCHEMA',
        'SNOWFLAKE_ROLE',
        'SNOWFLAKE_DATABASE',
        'SNOWFLAKE_MAX_ROWS',
        'SNOWFLAKE_QUERY_TIMEOUT'
      ]
    };
  }
}

module.exports = SnowflakeDatabase;