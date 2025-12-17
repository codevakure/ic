const { logger } = require('@librechat/data-schemas');
const { extractOidcGroups } = require('./oidcUtils');

/**
 * OIDC Group-based Agent Filtering Utility
 * 
 * This module provides functionality to filter agents based on OIDC group memberships.
 * It's designed to be easily removable/reversible for developers.
 * 
 * BUSINESS LOGIC:
 * - LibreChatAdmin group: Can see all agents (no filtering applied)
 * - LibreChatConsumer group: Can only see "Consumer Agent" (filtered by title)
 * - LibreChatEconomic group: Can only see "Economic" and "Marketplace" agents (filtered by title)
 * - Users without these specific groups: See no agents (hidden for security)
 * 
 * DEVELOPER NOTES:
 * - To disable this filtering: Simply don't call `filterAgentsByOidcGroups` in the endpoint
 * - To modify filtering logic: Update the `getPermittedAgentTitles` function
 * - All filtering is based on agent.name (title) field
 * 
 * @author Auto-generated for OIDC group-based agent access control
 * @version 1.0.0
 */

/**
 * Determines which agent titles a user can access based on their OIDC groups
 * @param {string[]} oidcGroups - Array of OIDC groups from user
 * @returns {string[] | null} Array of permitted agent title patterns, or null for no filtering
 */
function getPermittedAgentTitles(oidcGroups) {
  // If no OIDC groups or empty array, allow all agents
  if (!oidcGroups || !Array.isArray(oidcGroups) || oidcGroups.length === 0) {
    return null; // null means no filtering
  }

  logger.debug('[agentOidcFilter] Processing OIDC groups:', oidcGroups);

  // LibreChatAdmin group - can see all agents (no filtering)
  if (oidcGroups.includes('LibreChatAdmin')) {
    logger.debug('[agentOidcFilter] User has LibreChatAdmin group - allowing access to all agents');
    return null; // null means no filtering - show all agents
  }

  // Combine permissions for multiple groups
  const permittedTitles = [];
  
  // LibreChatConsumer group - Consumer Agent
  if (oidcGroups.includes('LibreChatConsumer')) {
    logger.debug('[agentOidcFilter] User has LibreChatConsumer group - adding Consumer Agent access');
    permittedTitles.push('Consumer Agent'); // Exact match for agent with "Consumer Agent" in title
  }

  // LibreChatEconomic group - Economic and Marketplace agents
  if (oidcGroups.includes('LibreChatEconomic')) {
    logger.debug('[agentOidcFilter] User has LibreChatEconomic group - adding Economic and Marketplace agents access');
    permittedTitles.push('Economic', 'Marketplace'); // Agents containing "Economic" or "Marketplace" in title
  }

  // If user has permissions from multiple groups, return combined list
  if (permittedTitles.length > 0) {
    logger.debug('[agentOidcFilter] Combined permitted agent titles:', permittedTitles);
    return permittedTitles;
  }

  // If user has OIDC groups but not the specific ones we filter on, hide all agents
  logger.debug('[agentOidcFilter] User has OIDC groups but no matching filtering groups - hiding all agents');
  return []; // Empty array means no agents will be shown
}

/**
 * Filters agents array based on user's OIDC group permissions
 * @param {Object[]} agents - Array of agent objects with 'name' property
 * @param {Object} user - User object containing OIDC group information
 * @returns {Object[]} Filtered array of agents
 */
function filterAgentsByOidcGroups(agents, user) {
  try {
    logger.debug('[agentOidcFilter] Starting agent filtering for user:', user?.id);
    logger.debug('[agentOidcFilter] Total agents before filtering:', agents?.length || 0);

    // Extract OIDC groups from user
    const oidcGroups = extractOidcGroups(user);
    
    // Get permitted agent titles for this user
    const permittedTitles = getPermittedAgentTitles(oidcGroups);
    
    // If no filtering needed, return all agents
    if (permittedTitles === null) {
      logger.debug('[agentOidcFilter] No OIDC filtering applied - returning all agents');
      return agents;
    }

    // If empty array, hide all agents
    if (permittedTitles.length === 0) {
      logger.debug('[agentOidcFilter] User has OIDC groups but no matching roles - hiding all agents');
      return [];
    }

    logger.debug('[agentOidcFilter] Filtering agents by permitted titles:', permittedTitles);

    // Filter agents based on permitted titles
    const filteredAgents = agents.filter(agent => {
      if (!agent || !agent.name) {
        logger.warn('[agentOidcFilter] Agent missing name property:', agent?.id);
        return false;
      }

      // Check if agent name contains any of the permitted title patterns
      const isPermitted = permittedTitles.some(titlePattern => 
        agent.name.toLowerCase().includes(titlePattern.toLowerCase())
      );

      if (isPermitted) {
        logger.debug(`[agentOidcFilter] Agent "${agent.name}" matches permitted titles - included`);
      } else {
        logger.debug(`[agentOidcFilter] Agent "${agent.name}" does not match permitted titles - excluded`);
      }

      return isPermitted;
    });

    logger.debug('[agentOidcFilter] Filtered agents count:', filteredAgents.length);
    logger.debug('[agentOidcFilter] Filtered agent names:', filteredAgents.map(a => a.name));

    return filteredAgents;

  } catch (error) {
    logger.error('[agentOidcFilter] Error filtering agents by OIDC groups:', error);
    // On error, return original agents array to avoid breaking functionality
    return agents;
  }
}

/**
 * DEVELOPER DOCUMENTATION
 * 
 * USAGE EXAMPLE:
 * ```javascript
 * const { filterAgentsByOidcGroups } = require('~/server/utils/agentOidcFilter');
 * 
 * // In your endpoint handler:
 * const allAgents = await getListAgentsByAccess({ ... });
 * const filteredAgents = filterAgentsByOidcGroups(allAgents.data, req.user);
 * allAgents.data = filteredAgents;
 * return res.json(allAgents);
 * ```
 * 
 * TO DISABLE FILTERING:
 * - Simply comment out or remove the call to `filterAgentsByOidcGroups`
 * - The endpoint will work normally without any OIDC group filtering
 * 
 * TO MODIFY FILTERING RULES:
 * - Edit the `getPermittedAgentTitles` function above
 * - Add new OIDC groups and their corresponding permitted agent title patterns
 * 
 * TESTING:
 * - Users with no OIDC groups: See all agents
 * - Users with LibreChatAdmin: See all agents (admin access)
 * - Users with LibreChatConsumer: Only see agents with "Consumer Agent" in title
 * - Users with LibreChatEconomic: Only see agents with "Economic" or "Marketplace" in title
 * - Users with other OIDC groups: See no agents (security default)
 */

module.exports = {
  filterAgentsByOidcGroups,
  getPermittedAgentTitles, // Exported for testing purposes
};
