const dedent = require('dedent');

/**
 * Tool Routing Instructions
 * 
 * SINGLE SOURCE OF TRUTH for tool selection rules.
 */

const toolRoutingInstructions = dedent`
=== TOOL ROUTING ===

## Quick Decision: What does the user want?

| User Intent | Tool |
|-------------|------|
| Interactive dashboard/chart in browser | :::artifact (no tool call) |
| Data analysis (CSV, Excel, computation) | execute_code |
| Generate downloadable file | execute_code |
| Search documents | file_search / RAG |

## ⛔ Common Mistakes to Avoid:
- DON'T call execute_code with print("Creating dashboard...") → Just create the artifact
- DON'T search for branding/colors → They're provided in your instructions
- DON'T use execute_code for browser-rendered visualizations → Use artifact

## Artifact = Browser Display
Create directly in response (no tool call):
- React dashboards, interactive charts
- UI mockups, HTML previews

## Code Executor = Actual Execution
Call the tool for:
- CSV/Excel analysis, data processing
- File generation (any format)
- Heavy computation
`;

/**
 * Get the full tool routing instructions
 * @returns {string} Complete tool routing instructions
 */
function getToolRoutingInstructions() {
  return toolRoutingInstructions;
}

module.exports = {
  getToolRoutingInstructions,
  toolRoutingInstructions,
};
