const { z } = require('zod');
const { Tool } = require('@langchain/core/tools');
const { BedrockAgentRuntimeClient, RetrieveCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { logger } = require('@librechat/data-schemas');

const AWS_ERROR_MESSAGES = {
  AccessDeniedException: 'Access denied to the AWS Bedrock Knowledge Base. Make sure your AWS credentials have the "bedrock:Retrieve" permission for this knowledge base ID.',
  ResourceNotFoundException: 'The specified knowledge base ID was not found. Please verify the knowledge base ID is correct.',
  ValidationException: 'Invalid request parameters. Please check your query and try again.',
  ThrottlingException: 'Request throttled by AWS Bedrock. Please try again later.',
  UnrecognizedClientException: 'The security token included in the request is invalid or has expired. Please check your AWS credentials.',
};

/**
 * Tool for AWS Bedrock Knowledge Base retrieval.
 * Allows agents to search and retrieve information from configured AWS Bedrock Knowledge Bases.
 */
class BedrockKnowledgeBase extends Tool {
  // Constants for default values
  static DEFAULT_API_VERSION = '2023-09-30';
  static DEFAULT_MAX_RESULTS = 5;
  static DEFAULT_REGION = 'us-east-1';

  // Helper function for initializing properties
  _initializeField(field, envVar, defaultValue) {
    return field || process.env[envVar] || defaultValue;
  }

  constructor(fields = {}) {
    super();
    this.name = 'BedrockKnowledgeBase';
    this.description = 
      'Search and retrieve information from AWS Bedrock Knowledge Base using natural language queries. ' +
      'This tool provides access to your organization\'s knowledge base for accurate, context-aware information retrieval.';
    
    /* Used to initialize the Tool without necessary variables. */
    this.override = fields.override ?? false;

    // Define schema for the tool input
    this.schema = z.object({
      query: z.string().describe(
        'Natural language search query to find relevant information in the knowledge base. ' +
        'Be specific and include key terms related to the information you\'re looking for.'
      ),
      max_results: z.number().min(1).max(20).optional().describe(
        'Maximum number of results to return (1-20, default: 5)'
      ),
    });

    // IMPORTANT: Get the knowledge base ID from user authentication (passed by loadToolWithAuth)
    // This is the ID provided by the user when they add the tool in the agent builder
    this.knowledgeBaseId = fields.BEDROCK_KNOWLEDGE_BASE_ID;

    // Get AWS credentials from environment or passed fields
    this.accessKeyId = this._initializeField(fields.AWS_ACCESS_KEY_ID, 'AWS_ACCESS_KEY_ID', null);
    this.secretAccessKey = this._initializeField(fields.AWS_SECRET_ACCESS_KEY, 'AWS_SECRET_ACCESS_KEY', null);
    this.region = this._initializeField(fields.AWS_REGION, 'AWS_REGION', BedrockKnowledgeBase.DEFAULT_REGION);
    this.sessionToken = this._initializeField(fields.AWS_SESSION_TOKEN, 'AWS_SESSION_TOKEN', null);

    // Validate required fields unless in override mode
    if (!this.override) {
      this._validateConfiguration();
    }

    // Initialize the Bedrock client
    if (!this.override) {
      this._initializeClient();
    }
  }

  _validateConfiguration() {
    const missingFields = [];

    if (!this.knowledgeBaseId) {
      missingFields.push('Knowledge Base ID');
    }

    if (!this.accessKeyId) {
      missingFields.push('AWS Access Key ID');
    }

    if (!this.secretAccessKey) {
      missingFields.push('AWS Secret Access Key');
    }

    if (missingFields.length > 0) {
      throw new Error(
        `AWS Bedrock Knowledge Base tool is missing required configuration: ${missingFields.join(', ')}. ` +
        'Please provide these values in the tool configuration.'
      );
    }
  }

  _initializeClient() {
    try {
      const clientConfig = {
        region: this.region,
        apiVersion: BedrockKnowledgeBase.DEFAULT_API_VERSION,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        },
      };

      // Add session token if provided (for temporary credentials)
      if (this.sessionToken) {
        clientConfig.credentials.sessionToken = this.sessionToken;
      }

      this.client = new BedrockAgentRuntimeClient(clientConfig);

      logger.info(`BedrockKnowledgeBase tool initialized for Knowledge Base: ${this.knowledgeBaseId}`);
    } catch (error) {
      logger.error('Failed to initialize AWS Bedrock client:', error);
      throw new Error(`Failed to initialize AWS Bedrock client: ${error.message}`);
    }
  }

  async _call(input) {
    if (this.override) {
      return 'AWS Bedrock Knowledge Base tool is not configured.';
    }

    const { query, max_results = BedrockKnowledgeBase.DEFAULT_MAX_RESULTS } = input;

    if (!query || query.trim().length === 0) {
      return 'Please provide a search query.';
    }

    try {
      logger.info(`BedrockKnowledgeBase searching: "${query}" (max_results: ${max_results})`);

      const command = new RetrieveCommand({
        knowledgeBaseId: this.knowledgeBaseId,
        retrievalQuery: {
          text: query.trim(),
        },
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults: Math.min(Math.max(max_results, 1), 20),
          },
        },
      });

      const response = await this.client.send(command);
      
      return this._formatResults(response, query);

    } catch (error) {
      logger.error('BedrockKnowledgeBase query error:', error);
      return this._handleError(error);
    }
  }

  _formatResults(response, originalQuery) {
    const { retrievalResults } = response;

    if (!retrievalResults || retrievalResults.length === 0) {
      return `No relevant information found in the knowledge base for query: "${originalQuery}". You may want to try rephrasing your search or using different keywords.`;
    }

    let formattedResponse = `Found ${retrievalResults.length} relevant results for "${originalQuery}":\n\n`;

    retrievalResults.forEach((result, index) => {
      const { content, score, location } = result;
      
      // Extract the text content
      const textContent = content?.text || 'No content available';
      
      // Add result with metadata
      formattedResponse += `**Result ${index + 1}** (Relevance Score: ${(score || 0).toFixed(2)}):\n`;
      formattedResponse += `${textContent}\n`;
      
      // Add source information if available
      if (location?.s3Location) {
        const s3Location = location.s3Location;
        if (s3Location.uri) {
          formattedResponse += `*Source: ${s3Location.uri}*\n`;
        }
      } else if (location?.webLocation) {
        const webLocation = location.webLocation;
        if (webLocation.url) {
          formattedResponse += `*Source: ${webLocation.url}*\n`;
        }
      }
      
      formattedResponse += '\n---\n\n';
    });

    // Add usage tip
    formattedResponse += `💡 *Tip: You can ask follow-up questions or request more specific information about any of these results.*`;

    return formattedResponse;
  }

  _handleError(error) {
    const errorCode = error.name || error.code;
    const errorMessage = AWS_ERROR_MESSAGES[errorCode] || error.message || 'Unknown error occurred';

    logger.error(`BedrockKnowledgeBase error [${errorCode}]:`, error);

    // Return user-friendly error messages
    switch (errorCode) {
      case 'AccessDeniedException':
        return 'Access denied to the knowledge base. Please verify your AWS credentials and permissions.';
      
      case 'ResourceNotFoundException':
        return `Knowledge base not found. Please verify the knowledge base ID: ${this.knowledgeBaseId}`;
      
      case 'ValidationException':
        return 'Invalid search parameters. Please check your query and try again.';
      
      case 'ThrottlingException':
        return 'Request rate limit exceeded. Please wait a moment and try again.';
      
      case 'UnrecognizedClientException':
        return 'AWS credentials are invalid or expired. Please update your credentials.';
      
      default:
        return `Search failed: ${errorMessage}. Please try again or contact support if the issue persists.`;
    }
  }

  // Helper method to test the connection (useful for debugging)
  async testConnection() {
    if (this.override) {
      return { success: false, message: 'Tool not configured' };
    }

    try {
      // Try a simple query to test the connection
      const testQuery = 'test';
      const command = new RetrieveCommand({
        knowledgeBaseId: this.knowledgeBaseId,
        retrievalQuery: { text: testQuery },
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults: 1,
          },
        },
      });

      await this.client.send(command);
      return { 
        success: true, 
        message: `Successfully connected to knowledge base: ${this.knowledgeBaseId}` 
      };
      
    } catch (error) {
      return { 
        success: false, 
        message: `Connection failed: ${error.message}`,
        error: error.name || error.code
      };
    }
  }
}

module.exports = BedrockKnowledgeBase;
