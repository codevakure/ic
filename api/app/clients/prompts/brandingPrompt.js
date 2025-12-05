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

// Default branding configuration - Texas Capital Brand Colors
const DEFAULT_BRANDING = {
  label: 'AI Assistant',
  description: 'A helpful AI assistant.',
  colors: {
    // Primary Colors
    primaryNavy: '#000033',
    primaryGrayDark: '#4A4B64',
    primaryGrayMid: '#878798',
    primaryGrayLight: '#828282',
    primaryGrayLighter: '#9D9FA2',
    primaryBlueLight: '#C0C1C2',
    primarySilver: '#C3C3CB',
    primaryPale: '#EEEFEF',
    // Accent Colors (use sparingly)
    accentRed: '#CC0000',      // Do not use in charts
    accentCyan: '#00C1D5',
    accentOrange: '#FE8F1D',
    accentYellow: '#FDDA24',
    accentBrown: '#DDCBA4',
    // Standard
    white: '#FFFFFF',
  },
  chartColors: [
    '#000033',  // Primary Navy (main)
    '#4A4B64',  // Dark Gray
    '#00C1D5',  // Cyan (accent)
    '#878798',  // Mid Gray
    '#FE8F1D',  // Orange (accent)
    '#828282',  // Light Gray
    '#FDDA24',  // Yellow (accent)
    '#DDCBA4',  // Brown (accent)
    '#9D9FA2',  // Lighter Gray
    '#C0C1C2',  // Light Blue
    '#C3C3CB',  // Silver
    '#EEEFEF',  // Pale
  ],
  tone: 'professional and helpful',
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
 * @returns {{ label: string, description: string, colors: Object, chartColors: Array, tone: string }}
 */
function getBrandingConfig(endpointConfig) {
  return {
    label: endpointConfig?.endpointCustomLabel || DEFAULT_BRANDING.label,
    description: endpointConfig?.endpointCustomDescription || DEFAULT_BRANDING.description,
    colors: endpointConfig?.brandingColors || DEFAULT_BRANDING.colors,
    chartColors: endpointConfig?.chartColors || DEFAULT_BRANDING.chartColors,
    tone: endpointConfig?.brandingTone || DEFAULT_BRANDING.tone,
  };
}

/**
 * Generate branding and context prompt with explicit instructions.
 * Structured for optimal performance with all models including Amazon Nova.
 * Uses TOON format for clear, structured information.
 * 
 * @param {Object} options - Configuration options
 * @returns {string} The formatted branding prompt
 */
function generateBrandingPrompt(options = {}) {
  const { req, endpointConfig } = options;

  const { label, description, colors, chartColors, tone } = getBrandingConfig(endpointConfig);
  const userName = req?.user?.name || req?.user?.username || 'User';
  const currentDateTime = formatDateTime(getUserTimezone(req));

  return `=== IDENTITY ===
Name: ${label}
Description: ${description}
Tone: ${tone}

=== BRAND COLORS ===
Primary Colors:
  Navy (main): ${colors.primaryNavy}
  Dark Gray: ${colors.primaryGrayDark}
  Mid Gray: ${colors.primaryGrayMid}
  Light Gray: ${colors.primaryGrayLight}
  Pale: ${colors.primaryPale}
  White: ${colors.white}

Accent Colors (use sparingly):
  Red: ${colors.accentRed} (CRITICAL: NEVER use in charts or visualizations)
  Cyan: ${colors.accentCyan}
  Orange: ${colors.accentOrange}
  Yellow: ${colors.accentYellow}
  Brown: ${colors.accentBrown}

Chart Color Palette (in order of preference):
${chartColors.map((color, i) => `  ${i + 1}. ${color}`).join('\n')}

=== SESSION CONTEXT ===
Current Time: ${currentDateTime}
User Name: ${userName}
Timezone: CST

=== RESPONSE GUIDELINES ===
1. Always respond as ${label}
2. Maintain a ${tone} tone in all interactions
3. When user asks for time/date/day, use the Current Time value above
4. When creating charts or visualizations, use the Chart Color Palette above
5. Primary Navy (${colors.primaryNavy}) should be the dominant color
6. CRITICAL: Never use Red (${colors.accentRed}) in charts or visualizations - reserved for branding only
7. Never apologize for or disclaim your capabilities
8. Never mention internal tools, functions, or technical processes
9. Present information naturally without exposing how it was obtained`;
}

/**
 * Generate minimal branding (for title generation, etc.)
 * Uses TOON format for consistency.
 * @param {Object} options - Configuration options
 * @returns {string} Minimal branding prompt
 */
function generateMinimalBrandingPrompt(options = {}) {
  const { req, endpointConfig } = options;
  const { label, tone } = getBrandingConfig(endpointConfig);
  const userName = req?.user?.name || req?.user?.username || 'User';
  return `Identity: ${label}
User: ${userName}
Tone: ${tone}`;
}

module.exports = {
  generateBrandingPrompt,
  generateMinimalBrandingPrompt,
  getBrandingConfig,
  getUserTimezone,
  formatDateTime,
  DEFAULT_BRANDING,
};
