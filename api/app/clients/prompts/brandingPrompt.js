/**
 * Branding Prompt Generator
 * 
 * Generates a structured context prompt optimized for all models including Amazon Nova.
 * Follows AWS Nova best practices:
 * - Clear persona/role definition
 * - Explicit instructions with hierarchy adherence
 * - Factual context that MUST be used
 * 
 * @see https://docs.aws.amazon.com/nova/latest/userguide/prompting-system-role.html
 */

// Default branding configuration
const DEFAULT_BRANDING = {
  label: 'AI Assistant',
  description: 'A helpful AI assistant.',
};

/**
 * Get the user's timezone - defaults to CST (America/Chicago)
 * @param {Object} req - Express request object
 * @returns {string} Timezone string
 */
function getUserTimezone(req) {
  return req?.headers?.['x-timezone'] || req?.user?.timezone || 'America/Chicago';
}

/**
 * Format the current date and time
 * @param {string} timezone - IANA timezone string (defaults to CST)
 * @returns {string} Formatted date/time string
 */
function formatDateTime(timezone = 'America/Chicago') {
  try {
    const now = new Date();
    return now.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
      timeZoneName: 'short',
    });
  } catch (error) {
    // Fallback: manual CST conversion (UTC-6)
    const now = new Date();
    const cstOffset = -6 * 60;
    const cstTime = new Date(now.getTime() + (cstOffset + now.getTimezoneOffset()) * 60000);
    return cstTime.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }) + ' CST';
  }
}

/**
 * Extract branding configuration from endpoint config
 * @param {Object} endpointConfig - Endpoint configuration
 * @returns {{ label: string, description: string }}
 */
function getBrandingConfig(endpointConfig) {
  return {
    label: endpointConfig?.endpointCustomLabel || DEFAULT_BRANDING.label,
    description: endpointConfig?.endpointCustomDescription || DEFAULT_BRANDING.description,
  };
}

/**
 * Generate branding and context prompt with explicit instructions.
 * Structured for optimal performance with all models including Amazon Nova.
 * 
 * @param {Object} options - Configuration options
 * @returns {string} The formatted branding prompt
 */
function generateBrandingPrompt(options = {}) {
  const { req, endpointConfig } = options;

  const { label, description } = getBrandingConfig(endpointConfig);
  const userName = req?.user?.name || req?.user?.username || 'User';
  const currentDateTime = formatDateTime(getUserTimezone(req));

  return `You are ${label}. ${description}

CURRENT_TIME="${currentDateTime}"
USER="${userName}"

RULES:
- If user asks for time/date/day, respond with CURRENT_TIME value. No apologies. No disclaimers.
- All times in CST.`;
}

/**
 * Generate minimal branding (for title generation, etc.)
 * @param {Object} options - Configuration options
 * @returns {string} Minimal branding prompt
 */
function generateMinimalBrandingPrompt(options = {}) {
  const { req, endpointConfig } = options;
  const { label } = getBrandingConfig(endpointConfig);
  const userName = req?.user?.name || req?.user?.username || 'User';
  return `You are ${label}. User: ${userName}.`;
}

module.exports = {
  generateBrandingPrompt,
  generateMinimalBrandingPrompt,
  getBrandingConfig,
  getUserTimezone,
  formatDateTime,
  DEFAULT_BRANDING,
};
