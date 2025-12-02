const { Tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { logger } = require('@ranger/data-schemas');

/**
 * Snowflake Financial Analyst Tool for Ranger Agents
 * Executes SQL queries against Snowflake data warehouse for financial analysis
 * Uses pre-configured credentials from environment variables
 */
class SnowflakeFinancialAnalyst extends Tool {
  static lc_name() {
    return 'SnowflakeFinancialAnalyst';
  }

  constructor(fields = {}) {
    super();
    this.name = 'SnowflakeFinancialAnalyst';
    this.description = 'Execute SQL queries against Snowflake data warehouse for financial data analysis. Specialized for financial metrics, reporting, and EDM database queries. Only SELECT queries are allowed for safety. Pre-configured with financial analyst credentials.';

    // Used to initialize the Tool without necessary variables
    this.override = fields.override ?? false;

    // Define schema for the tool input
    this.schema = z.object({
      query: z.string().describe(
        'SQL query to execute against the Snowflake EDM database for financial analysis. Only SELECT queries are allowed for security. ' +
        'Include proper Snowflake-specific syntax like database.schema.table naming when needed. ' +
        'Focus on financial metrics, reporting data, and EDM database content.'
      ),
    });

    // Pre-configured fields from environment variables (Financial Analyst configuration)
    this.account = process.env.SNOWFLAKE_FDM_ACCOUNT;
    this.username = process.env.SNOWFLAKE_FDM_USERNAME;
    this.password = process.env.SNOWFLAKE_FDM_PASSWORD;
    this.warehouse = process.env.SNOWFLAKE_FDM_WAREHOUSE;
    this.database = process.env.SNOWFLAKE_FDM_DATABASE;
    this.schemaName = process.env.SNOWFLAKE_FDM_SCHEMA;
    this.role = process.env.SNOWFLAKE_FDM_ROLE;

    // Optional configuration
    this.maxRows = parseInt(process.env.SNOWFLAKE_FDM_MAX_ROWS || '100', 10);
    this.queryTimeout = parseInt(process.env.SNOWFLAKE_FDM_QUERY_TIMEOUT || '30000', 10);
    
    // Connection state
    this.connection = null;
    this.isConnected = false;

    // Validate required fields unless in override mode
    if (!this.override) {
      this._validateConfiguration();
    }
  }

  /**
   * Validate required configuration fields
   */
  _validateConfiguration() {
    const requiredFields = ['account', 'username', 'password', 'warehouse', 'role'];
    const missingFields = requiredFields.filter(field => !this[field]);
    
    if (missingFields.length > 0) {
      const errorMsg = `Missing required Financial Analyst Snowflake configuration: ${missingFields.join(', ')}. Please set the corresponding environment variables: ${missingFields.map(f => `SNOWFLAKE_FDM_${f.toUpperCase()}`).join(', ')}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Create and configure Snowflake connection
   */
  async _createConnection() {
    if (this.isConnected && this.connection) {
      return this.connection;
    }

    try {
      const snowflake = require('snowflake-sdk');
      
      const connectionOptions = {
        account: this.account,
        username: this.username,
        password: this.password,
        warehouse: this.warehouse,
        role: this.role,
        application: 'RANGER_FINANCIAL_ANALYST'
      };

      // Add database if specified
      if (this.database && this.database.trim()) {
        connectionOptions.database = this.database.trim();
      }

      // Add schema if specified
      if (this.schemaName && this.schemaName.trim()) {
        connectionOptions.schema = this.schemaName.trim();
      }

      return new Promise((resolve, reject) => {
        const connection = snowflake.createConnection(connectionOptions);
        
        connection.connect((err, conn) => {
          if (err) {
            logger.error('Failed to connect to Snowflake (Financial Analyst):', err.message);
            reject(new Error(`Snowflake Financial Analyst connection failed: ${err.message}`));
          } else {
            logger.info('Successfully connected to Snowflake Financial Analyst');
            this.connection = conn;
            this.isConnected = true;
            resolve(conn);
          }
        });
      });
    } catch (error) {
      logger.error('Error creating Snowflake Financial Analyst connection:', error.message);
      throw new Error(`Failed to create Snowflake Financial Analyst connection: ${error.message}`);
    }
  }

  /**
   * Validate SQL query for security
   */
  _validateQuery(query) {
    const trimmedQuery = query.trim().toLowerCase();
    
    // Only allow SELECT statements
    if (!trimmedQuery.startsWith('select')) {
      throw new Error('Only SELECT queries are allowed for security reasons. Please modify your query to use SELECT only.');
    }

    // Block potentially dangerous operations
    const dangerousPatterns = [
      /\b(drop|delete|insert|update|alter|create|truncate|grant|revoke)\b/i,
      /\b(exec|execute|sp_|xp_)\b/i,
      /--|\/\*|\*\//,  // SQL comments that could hide malicious code
      /\binto\s+outfile\b/i,
      /\bload_file\b/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        throw new Error('Query contains potentially unsafe operations. Only SELECT queries are allowed.');
      }
    }

    return true;
  }

  /**
   * Execute SQL query against Snowflake
   */
  async _executeQuery(query) {
    const connection = await this._createConnection();
    
    return new Promise((resolve, reject) => {
      const statement = connection.execute({
        sqlText: query,
        timeout: this.queryTimeout,
        fetchAsString: ['Number', 'Date', 'JSON'], // Ensure consistent data types
        complete: (err, stmt, rows) => {
          if (err) {
            logger.error('Snowflake Financial Analyst query execution failed:', err.message);
            reject(new Error(`Query execution failed: ${err.message}`));
          } else {
            // Limit rows returned for performance
            const limitedRows = rows.slice(0, this.maxRows);
            if (rows.length > this.maxRows) {
              logger.warn(`Query returned ${rows.length} rows, limited to ${this.maxRows}`);
            }
            resolve(limitedRows);
          }
        }
      });
    });
  }

  /**
   * Format query results for response
   */
  _formatResults(rows, query) {
    if (!rows || rows.length === 0) {
      return `Query executed successfully but returned no results.\n\nQuery: ${query}`;
    }

    try {
      // Get column names from first row
      const columns = Object.keys(rows[0]);
      const rowCount = rows.length;
      
      // Create formatted table
      let result = `Financial Analysis Query Results (${rowCount} rows):\n\n`;
      
      // Add column headers
      result += columns.join(' | ') + '\n';
      result += columns.map(() => '---').join(' | ') + '\n';
      
      // Add data rows (limit display for readability)
      const displayRows = rows.slice(0, Math.min(20, rows.length));
      for (const row of displayRows) {
        const values = columns.map(col => {
          const val = row[col];
          return val !== null && val !== undefined ? String(val) : 'NULL';
        });
        result += values.join(' | ') + '\n';
      }
      
      if (rows.length > 20) {
        result += `\n... (showing first 20 rows of ${rows.length} total)\n`;
      }
      
      result += `\nQuery executed: ${query}`;
      result += `\nDatabase: ${this.database || 'default context'}`;
      result += `\nWarehouse: ${this.warehouse}`;
      
      return result;
    } catch (error) {
      logger.error('Error formatting Financial Analyst query results:', error.message);
      return `Query completed successfully with ${rows.length} rows, but encountered formatting error: ${error.message}`;
    }
  }

  /**
   * Main tool execution method
   */
  async _call(arg) {
    const { query } = arg;
    
    try {
      
      // Validate query for security
      this._validateQuery(query);
      
      // Execute query
      const results = await this._executeQuery(query);
      
      // Format and return results
      const formattedResults = this._formatResults(results, query);
      
      logger.info(`Financial Analyst query executed successfully, returned ${results.length} rows`);
      return formattedResults;
      
    } catch (error) {
      logger.error('Financial Analyst Snowflake tool error:', error.message);
      return `Error executing Financial Analyst query: ${error.message}`;
    }
  }

  /**
   * Clean up resources
   */
  async destroy() {
    if (this.connection && this.isConnected) {
      try {
        await new Promise((resolve) => {
          this.connection.destroy((err) => {
            if (err) {
              logger.warn('Error closing Financial Analyst Snowflake connection:', err.message);
            } else {
              logger.info('Financial Analyst Snowflake connection closed successfully');
            }
            resolve();
          });
        });
      } catch (error) {
        logger.warn('Error during Financial Analyst connection cleanup:', error.message);
      } finally {
        this.connection = null;
        this.isConnected = false;
      }
    }
  }
}

module.exports = SnowflakeFinancialAnalyst;