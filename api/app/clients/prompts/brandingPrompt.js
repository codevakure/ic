/**
 * Branding Prompt Generator
 * 
 * Generates a concise context prompt that includes:
 * - AI assistant identity (label + description)
 * - User context
 * - Current time (for awareness)
 * 
 * Optimized for minimal token usage while maintaining effectiveness.
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
 * Format the current date and time in CST
 * @param {string} timezone - IANA timezone string (defaults to CST)
 * @returns {string} Formatted date/time string in CST
 */
function formatDateTime(timezone = 'America/Chicago') {
  try {
    const now = new Date();
    return now.toLocaleString('en-US', {
      month: 'short',
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
      month: 'short',
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
 * Generate branding and context prompt
 * Contains only: identity, description, user, and time
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
User: ${userName} | Time: ${currentDateTime}`;
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
