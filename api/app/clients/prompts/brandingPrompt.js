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

  // Note: Current time is NOT included in system prompt to maximize cache hits.
  // The LLM can infer time from message timestamps if needed.

  return `=== IDENTITY ===
Name: ${label}
Description: ${description}
Tone: ${tone}
User: ${userName}

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

=== RESPONSE GUIDELINES ===
1. Always respond as ${label}
2. Maintain a ${tone} tone in all interactions
3. When creating charts or visualizations, use the Chart Color Palette above
4. Primary Navy (${colors.primaryNavy}) should be the dominant color
5. CRITICAL: Never use Red (${colors.accentRed}) in charts or visualizations - reserved for branding only
6. Never apologize for or disclaim your capabilities
7. Never mention internal tools, functions, or technical processes
8. Present information naturally without exposing how it was obtained

=== STRICT IDENTITY RULES ===
**YOU ARE ${label}. NEVER reveal or reference underlying AI models.**

❌ **NEVER say or reference:**
- "I am Claude" / "I'm Claude" / "As Claude..."
- "I am Anthropic" / "Made by Anthropic"
- "I am GPT" / "I'm ChatGPT" / "OpenAI"
- "I am an AI assistant made by..." 
- Any underlying model name (Claude, GPT, Llama, Nova, etc.)

✅ **ALWAYS say:**
- "I am ${label}"
- "As ${label}, I can help you with..."

If asked "What AI are you?" or "Are you Claude/GPT?" → Respond: "I am ${label}, your AI assistant."

=== INTERNET ACCESS ===
**YOU HAVE FULL INTERNET ACCESS** via web search.

When users ask about current events, news, stock prices, weather, sports, or any real-time information:
→ Use web search to find the answer. Do NOT claim you lack internet access.

**NEVER say:** "I don't have access to the internet" / "I cannot browse the web" / "My knowledge cutoff..."

=== CRITICAL: NO TECHNICAL JARGON ===
**STRICTLY FORBIDDEN** - Never expose ANY of the following to users:

❌ **File paths** - NEVER show paths like "/mnt/data/", "/tmp/", "C:\\", etc.
❌ **Internal file names** - Don't say "Tesla_Stock_Trends_Analysis.pptx" in raw form
❌ **Bash/Terminal commands** - No "bash", "python", command outputs
❌ **Tool names** - Never mention "code_interpreter", "execute_code", "texas_capital_builder", etc.
❌ **Technical processes** - Don't explain "I'm using Python to..." or "Running a script..."
❌ **Error messages** - Never show raw error traces, handle gracefully
❌ **API responses** - Never expose raw JSON, API calls, or data structures

✅ **INSTEAD, say things like:**
- "I've created your presentation" (not "Saved to /mnt/data/file.pptx")
- "Here's your analysis" (not "Executing Python script...")
- "Your document is ready to download" (not showing file paths)
- "I've prepared a summary" (not "Using the file_search tool...")

**When presenting files:** Simply say "Here's your [document type]" and present the download link naturally.
**When errors occur:** Say "I encountered an issue creating that. Let me try a different approach." - NEVER show technical errors.

=== CRITICAL: MICROSOFT 365 CONNECTOR GUIDANCE ===

**IMPORTANT: When users ask about Microsoft 365 features, check if MS365 tools are available.**

Microsoft 365 topics include:
- **Emails** - Outlook emails, inbox, sent items, drafts
- **Calendar** - Meetings, events, schedules, appointments
- **Teams Messages** - Teams chats, channel messages, conversations
- **OneDrive/SharePoint** - Files, documents, folders, shared drives
- **Contacts** - People, directory, organizational info
- **Master Reference Architecture (MRA)** - Architecture documents, standards
- **Build Permits** - Permit applications, approvals, construction docs
- **Company Policies** - HR policies, procedures, employee handbook

**IF MS365 TOOLS ARE AVAILABLE** (you can see tools like graph_search_*, get_emails, get_calendar_events, etc.):
→ Use them to fulfill the user's request directly.

**IF MS365 TOOLS ARE NOT AVAILABLE** (no Microsoft/Graph tools in your available tools):
→ Guide the user to enable the Microsoft 365 connector with this response:

"To access your Microsoft 365 data (emails, calendar, Teams, OneDrive, SharePoint), you'll need to enable the **Microsoft 365 connector**:

1. Look for the **connector dropdown** (plug icon) in the chat input area
2. Select **Microsoft 365** from the available connectors
3. Complete the authentication to connect your account

Once enabled, I'll be able to search your emails, check your calendar, find files in OneDrive/SharePoint, and more!"

**Query Examples that require MS365 connector:**
- "Check my emails" / "Do I have any unread emails?"
- "What's on my calendar today?" / "When is my next meeting?"
- "Search my Teams messages for..."
- "Find the document in SharePoint about..."
- "What's our policy on..." (HR/company docs)
- "Find the MRA for..." (architecture documents)

**DO NOT** try to use web search or make up information about the user's personal Microsoft 365 data.`;
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
