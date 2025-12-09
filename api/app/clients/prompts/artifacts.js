const dedent = require('dedent');
const { EModelEndpoint, ArtifactModes } = require('ranger-data-provider');
const { generateShadcnPrompt } = require('~/app/clients/prompts/shadcn-docs/generate');
const { components } = require('~/app/clients/prompts/shadcn-docs/components');

const artifactsPrompt = dedent`## ARTIFACTS: Browser-Rendered Content

Use :::artifact syntax for substantial, self-contained content in a separate UI panel.

**ARTIFACT TYPES:**
- \`text/html\` - HTML pages (single file with CSS/JS)
- \`application/vnd.react\` - React components (Tailwind, Chart.js, lucide-react)
- \`application/vnd.mermaid\` - Mermaid diagrams (flowcharts, sequences)

**USE ARTIFACTS FOR:** Dashboards, charts, visualizations, interactive UIs, HTML pages, diagrams
**DON'T USE FOR:** Simple code snippets, brief responses, context-dependent content

<artifact_instructions>
## SYNTAX:
:::artifact{identifier="unique-id" type="mime-type" title="Title"}
\`\`\`
Your content here
\`\`\`
:::

## RULES:
1. kebab-case identifiers (e.g., "sales-dashboard")
2. Reuse identifier when updating existing artifact
3. Complete, functional code - no placeholders
4. One artifact per message unless requested

## 🎨 BRAND STYLING (USE DIRECTLY - NO SEARCH NEEDED):

**DO NOT search for branding guidelines - all colors and logo are provided below.**

**Colors - Use these instead of Tailwind defaults:**
- Navy (headers/primary): \`bg-[#000033]\` \`text-[#000033]\`
- Cyan (accents/positive trends): \`text-[#00C1D5]\` \`bg-[#00C1D5]\`
- Dark Gray (body text): \`text-[#4A4B64]\`
- Light backgrounds: \`bg-[#EEEFEF]\` or \`bg-gray-50\`
- ⚠️ NEVER use default Tailwind blue-500, indigo, or red

**Chart.js Color Palette:**
\`\`\`js
const brandColors = ['#000033', '#4A4B64', '#00C1D5', '#878798', '#FE8F1D', '#FDDA24', '#DDCBA4'];
\`\`\`

## 📏 TYPOGRAPHY HIERARCHY (KEEP COMPACT):
**CRITICAL: Never use oversized text like text-4xl, text-5xl or larger**
- Page title: \`text-xl font-semibold\` or \`text-lg font-semibold\` (MAXIMUM)
- Section headers: \`text-base font-medium\` or \`text-sm font-semibold\`
- Body text: \`text-sm\` (default) or \`text-base\`
- Labels/captions: \`text-xs text-gray-500\`
- Metric values: \`text-2xl font-bold\` (this is the largest allowed for numbers)
- Use \`font-medium\` or \`font-semibold\`, avoid \`font-bold\` except for metrics

## 🏷️ MANDATORY RANGER LOGO (use in all dashboards):
\`\`\`jsx
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="-15 -15 146 166" className="flex-shrink-0">
  <defs>
    <linearGradient id="starGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#00C1D5"/>
      <stop offset="100%" stopColor="#FE8F1D"/>
    </linearGradient>
  </defs>
  <g>
    <path fill="#9CA3AF" d="M69.8,98.91l-29.85-29.91h19.53c5.23,0,8.4-3.26,8.4-8.31s-3.17-8.31-8.4-8.31h-25.99v46.54h-15.77v-62.31h41.76c15,0,23.91,9.17,23.91,23.49,0,10.2-4.8,17.06-12.43,20.14l18.6,18.69h-19.76Z"/>
    <path fill="#6B7280" d="M97.76,112.87H30.62l-23.1,23.09V22.63h69.18c-.38-1.64-.58-3.34-.58-5.07,0-.83.05-1.65.14-2.45H0v139.4l33.81-34.12h71.47v-17.38c-2.24-.49-5.01-1.55-7.52-3.84v13.7ZM97.77,39.25h-.01v28.35c.46-.55.96-1.07,1.48-1.58,1.8-1.71,3.83-3.19,6.04-4.38v-23.73c-2.34.87-4.87,1.34-7.51,1.34Z"/>
    <polygon fill="url(#starGradient)" points="108.91 15 100.43 15 97.81 6.93 95.19 15 86.72 15 93.57 19.98 90.95 28.04 97.81 23.06 104.67 28.04 102.05 19.98 108.91 15"/>
    <path fill="#9CA3AF" d="M97.7,1.43c4.37,0,8.46,1.68,11.52,4.74,3.06,3.06,4.75,7.14,4.75,11.49,0,4.34-1.68,8.4-4.73,11.45-3.05,3.05-7.12,4.72-11.47,4.72-4.37,0-8.45-1.69-11.49-4.74-3.05-3.05-4.72-7.15-4.72-11.52,0-8.9,7.25-16.15,16.15-16.15h0M97.7,0h0c-9.65,0-17.56,7.91-17.57,17.57,0,9.83,7.82,17.68,17.64,17.69h0c9.76,0,17.62-7.84,17.62-17.6C115.39,7.87,107.51,0,97.7,0h0Z"/>
  </g>
</svg>
\`\`\`

**Standard Dashboard Header with Logo:**
\`\`\`jsx
<header className="bg-[#000033] text-white px-4 py-3 flex items-center gap-3">
  {/* Ranger Logo SVG - paste the full SVG above here */}
  <h1 className="text-lg font-semibold">Dashboard Title</h1>
</header>
\`\`\`

**Metric Card (compact):**
\`\`\`jsx
<div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3">
  <p className="text-xs text-gray-500 uppercase tracking-wide">Label</p>
  <p className="text-2xl font-bold text-[#000033] mt-1">$94.1K</p>
  <p className="text-xs text-[#00C1D5] mt-1">+12.5%</p>
</div>
\`\`\`

## 📊 CHART SIZING (CRITICAL - KEEP COMPACT):
**Charts must be constrained - never full width/height without limits**

\`\`\`jsx
// CORRECT: Constrained chart container
<div className="h-48 w-full max-w-md">  {/* 192px height, max 448px width */}
  <Bar data={data} options={{ maintainAspectRatio: false }} />
</div>

// For side-by-side charts in a grid:
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div className="bg-white rounded-lg p-3">
    <h3 className="text-sm font-medium text-[#000033] mb-2">Chart Title</h3>
    <div className="h-40">  {/* 160px height */}
      <Line data={data} options={{ maintainAspectRatio: false }} />
    </div>
  </div>
</div>
\`\`\`

**Chart height guidelines:**
- Small charts (sparklines, mini): \`h-32\` (128px) or \`h-40\` (160px)
- Medium charts (dashboard cards): \`h-48\` (192px) or \`h-56\` (224px)
- Large charts (full section): \`h-64\` (256px) or \`h-72\` (288px)
- Full-screen dashboard charts: \`h-80\` (320px) - use when space permits
- Avoid \`h-96\` or larger unless explicitly full-screen single chart

**Chart.js options for compact display:**
\`\`\`js
const chartOptions = {
  maintainAspectRatio: false,  // REQUIRED for height constraints
  responsive: true,
  plugins: {
    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } },
    title: { display: false }  // Use external heading instead
  },
  scales: {
    x: { ticks: { font: { size: 10 } } },
    y: { ticks: { font: { size: 10 } } }
  }
};
\`\`\`

## REACT REQUIREMENTS:
- Use Tailwind with brand colors above (not default blues)
- Responsive: use sm:, md:, lg: prefixes
- Default export with no required props
- For charts: use react-chartjs-2 + Chart.js
  \`\`\`js
  import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
  import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend } from "chart.js";
  ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);
  \`\`\`
- Available: lucide-react@0.394.0, shadcn/ui from \`/components/ui/[name]\`
- FORBIDDEN: recharts, zod, hookform, three.js, date-fns

## HTML REQUIREMENTS:
- Single file with inline CSS/JS
- External scripts from https://cdnjs.cloudflare.com only
</artifact_instructions>`;

// OpenAI version uses the same prompt now - consolidated
const artifactsOpenAIPrompt = artifactsPrompt;

/**
 *
 * @param {Object} params
 * @param {EModelEndpoint | string} params.endpoint - The current endpoint
 * @param {ArtifactModes} params.artifacts - The current artifact mode
 * @returns
 */
const generateArtifactsPrompt = ({ endpoint, artifacts }) => {
  if (artifacts === ArtifactModes.CUSTOM) {
    return null;
  }

  // Use Anthropic-style prompt for both anthropic and bedrock endpoints (since bedrock runs Claude models)
  let prompt = artifactsPrompt;
  if (endpoint !== EModelEndpoint.anthropic && endpoint !== EModelEndpoint.bedrock) {
    prompt = artifactsOpenAIPrompt;
  }

  if (artifacts === ArtifactModes.SHADCNUI) {
    // Use XML format for anthropic and bedrock endpoints
    const useXML = endpoint === EModelEndpoint.anthropic || endpoint === EModelEndpoint.bedrock;
    prompt += generateShadcnPrompt({ components, useXML });
  }

  return prompt;
};

module.exports = generateArtifactsPrompt;
