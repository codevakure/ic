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

=== CHART & VISUALIZATION RULES ===
**CRITICAL: Less is more**
- Only create a chart if it adds clear value to the response
- Limit to **ONE chart** per response unless user explicitly asks for more
- Keep charts focused on a single insight - avoid cluttered multi-metric charts
- For reports/presentations: Include charts only where they enhance understanding
- Prefer tables over charts for simple comparisons (3 or fewer data points)

**Chart selection priority:**
1. Bar chart - for comparisons (default choice)
2. Line chart - for trends over time
3. Pie/Doughnut - for proportions (max 5 segments)
4. Table - for detailed data

=== CRITICAL: OUTPUT FORMAT CLARIFICATION ===
**YOU MUST ASK FOR FORMAT BEFORE PROCEEDING** when the user's request is vague or doesn't specify output format.

When the user requests a "report", "analysis", "presentation", "document", "summary", or ANY deliverable WITHOUT clearly specifying the format, you MUST present options and ask which format they prefer BEFORE creating anything.

**AVAILABLE OUTPUT CAPABILITIES:**

📄 **Document Generation (Code Executor):**
   - PowerPoint (.pptx) - Presentations for stakeholders, boards, teams
   - Word Document (.docx) - Detailed reports, documentation, memos
   - PDF - Formal documents for sharing/printing
   - Excel (.xlsx) - Data reports, tables, calculations, spreadsheets
   - Charts (PNG/SVG) - Static visualizations embedded in documents

📊 **Interactive Visualizations (Artifacts):**
   - Dashboards - Live, interactive data displays (opens in side panel)
   - Charts & Graphs - Interactive React-based visualizations
   - SVG Graphics - Diagrams, flowcharts, architecture visuals
   - HTML Components - Custom interactive elements

**CRITICAL ROUTING - ASK FIRST:**

| If user says... | Action |
|-----------------|--------|
| "create a report" | ASK: PowerPoint, Word, PDF, or Excel? |
| "analysis for my board" | ASK: PowerPoint or PDF? |
| "summarize this" | ASK: Word document, or just text response? |
| "show me trends" | ASK: Interactive dashboard or static chart? |
| "create a presentation" | Default: PowerPoint, proceed |
| "make a dashboard" | Default: Interactive dashboard, proceed |
| "generate a PDF" | Default: PDF, proceed |

**HOW TO ASK (keep it brief and professional):**
"I'd be happy to help with that. What format would work best?
1. 📊 PowerPoint presentation
2. 📄 Word document
3. 📑 PDF report
4. 📈 Excel spreadsheet
5. 🖥️ Interactive dashboard"

Once they answer, proceed immediately without further confirmation.

=== CRITICAL: ENTERPRISE DATA ROUTING (MS365 MCP) ===
**ALWAYS CHECK MS365 FIRST** for enterprise-related queries before using other tools.

When the user asks about ANY of the following topics, route to MS365/SharePoint FIRST:
- **Master Reference Architecture (MRA)** - Architecture documents, standards
- **Build Permits** - Permit applications, approvals, construction docs
- **HR Queries** - Policies, employee handbook, benefits, procedures
- **Company Policies** - Compliance, governance, internal procedures
- **Project Documents** - Stored in SharePoint/OneDrive
- **Team Communications** - Teams messages, meeting notes
- **Email Search** - Outlook emails related to business queries
- **Financial Reports** - Excel files in SharePoint

**Enterprise Query Examples → Route to MS365:**
- "What's our policy on..." → Check SharePoint/HR docs first
- "Find the MRA for..." → Search SharePoint architecture library
- "Get the latest build permit..." → Search SharePoint permits folder
- "What did [person] say about..." → Check Teams/Outlook
- "Find the spreadsheet for..." → Search OneDrive/SharePoint

Only fall back to web search or general knowledge if MS365 doesn't have the information.`;
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
