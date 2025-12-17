const { getUserPluginAuthValue } = require('~/server/services/PluginService');
const { decrypt } = require('@librechat/api');

/**
 * Load auth values for the specified authentication fields.
 * For agent tools (when agentId and toolKey are provided), only agent-embedded credentials are used.
 * For non-agent contexts, user credentials are used as fallback.
 *
 * @param {Object} params - The parameters object.
 * @param {string} params.userId - The user ID (used only for non-agent contexts).
 * @param {Array<string>} params.authFields - Array of authentication field names.
 * @param {string} [params.agentId] - Agent ID for agent-embedded credentials (agent context only).
 * @param {string} [params.toolKey] - Tool key for credential lookup (agent context only).
 * @param {Set<string>} [params.optional] - Optional fields that won't throw errors if missing.
 * @param {boolean} [params.throwError=true] - Whether to throw error if credential not found.
 * @returns {Promise<Object>} An object containing the authentication values.
 */
const loadAuthValues = async ({ userId, authFields, agentId, toolKey, optional, throwError = true }) => {
  const authValues = {};

  for (const authField of authFields) {
    let value = null;

    // Handle alternate authentication fields (e.g., "API_KEY||ALTERNATE_KEY")
    const alternateFields = authField.includes('||') ? authField.split('||').map(f => f.trim()) : [authField];
    
    // Try to find a value from any of the alternate fields
    for (const field of alternateFields) {
      // 1. Check environment variables first (admin-level override)
      value = process.env[field];
      if (value) {
        authValues[field] = value;
        break;
      }

      // 2. Check agent-embedded credentials (primary and only source for agents)
      if (agentId && toolKey) {
        try {
          const { getAgent } = require('~/models/Agent');
          const agent = await getAgent({ id: agentId });
          
          console.log(`[AGENT CREDENTIALS] Agent found: ${agent?.name}, has tool_credentials: ${!!agent?.tool_credentials}, toolKey in credentials: ${!!agent?.tool_credentials?.[toolKey]}`);
          if (agent?.tool_credentials) {
            console.log(`[AGENT CREDENTIALS] Available tool keys: ${Object.keys(agent.tool_credentials).join(', ')}`);
          }
          
          if (agent?.tool_credentials?.[toolKey]?.[field]) {
            // Decrypt the credential value
            value = await decrypt(agent.tool_credentials[toolKey][field]);
            if (value !== null && value !== undefined) {
              console.log(`[AGENT CREDENTIALS] Found credential for ${toolKey}.${field}`);
              authValues[field] = value;
              break;
            }
          }
        } catch (error) {
          // Log error but don't fallback to user credentials for agents
          console.error(`[AGENT CREDENTIALS] Error getting agent credentials for ${toolKey}.${field}:`, error.message);
        }
      } else {
        // 3. Only use user credentials when NOT in agent context (no agentId)
        try {
          value = await getUserPluginAuthValue(userId, field, false);
          if (value !== null && value !== undefined) {
            authValues[field] = value;
            break;
          }
        } catch (err) {
          // Continue to next alternate field or handle error
        }
      }
    }

    // Handle missing credentials
    if (value === null || value === undefined) {
      const isOptional = optional && alternateFields.some(field => optional.has(field));
      if (!isOptional && throwError) {
        const errorContext = agentId && toolKey 
          ? ` (agent-embedded credentials required for agent tools)` 
          : '';
        throw new Error(`No authentication found for field ${authField}${errorContext}`);
      }
    }
  }

  return authValues;
};

module.exports = {
  loadAuthValues,
};
