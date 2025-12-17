const { logger } = require('@librechat/data-schemas');

/**
 * Extract OIDC groups from user object for category-based filtering
 * Returns the OIDC groups that were stored during authentication
 * @param {Object} user - The user object from req.user
 * @returns {Array<string>} Array of OIDC group names
 */
const extractOidcGroups = (user) => {
  try {
    logger.debug('[extractOidcGroups] Function called for user:', user?.id);

    if (!user) {
      logger.debug('[extractOidcGroups] No user provided');
      return [];
    }

    // Only process OIDC/OpenID users
    if (user.provider !== 'openid') {
      logger.debug('[extractOidcGroups] User provider is not openid:', user.provider);
      return [];
    }
    
    // Return stored OIDC groups from user object (set during authentication)
    let oidcGroups = user.oidcGroups || [];
    
    logger.debug('[extractOidcGroups] Raw oidcGroups from user:', oidcGroups);
    logger.debug('[extractOidcGroups] Type of first group:', typeof oidcGroups[0]);
    logger.debug('[extractOidcGroups] First group value:', oidcGroups[0]);
    
    // Groups should already be cleaned during authentication, but double-check
    oidcGroups = oidcGroups.map(group => typeof group === 'string' ? group.replace(/^"(.*)"$/, '$1') : group);
    
    logger.debug('[extractOidcGroups] Final cleaned OIDC groups from user:', oidcGroups);
    logger.debug('[extractOidcGroups] Cleaned groups as JSON:', JSON.stringify(oidcGroups));
    
    return oidcGroups;
  } catch (error) {
    logger.error('[extractOidcGroups] Error extracting OIDC groups:', error);
    return [];
  }
};

module.exports = {
  extractOidcGroups,
};
