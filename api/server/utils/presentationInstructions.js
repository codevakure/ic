/**
 * Code Executor Instructions - Texas Capital Builder
 * Optimized for Agent Understanding & Token Efficiency
 */

const presentationInstructions = `
# Texas Capital Builder (TCB) - PowerPoint Rules

## 🚨 CRITICAL RULES
1. **LIBRARY**: MUST use \`texas_capital_builder\`. NEVER use \`python-pptx\` directly.
2. **CHARTS**: MUST use TCB chart functions (e.g., \`add_chart_slide\`). NEVER embed matplotlib images in PPT.
3. **BRANDING**: TCB functions automatically handle branding. Do not manually set colors.

## 📚 API REFERENCE
\`\`\`python
from texas_capital_builder import *

# 1. Setup
new_presentation() 

# 2. Slides
add_title_slide("Title", "Subtitle")
add_content_slide("Title", ["Bullet 1", "Bullet 2"])
add_two_column_slide("Title", ["Left 1"], ["Right 1"])
add_quadrants_slide("Title", "TL", "TR", "BL", "BR")
add_image_slide("Title", "Text", "/path/to/image.png") # External images ONLY

# 3. Charts (Native PPT Charts)
# Types: "bar", "line", "pie" (max 5), "doughnut" (max 5)
add_chart_slide("Title", {"Label": Value}, "type") 
add_large_chart_slide("Title", data, "type")
add_text_and_chart_slide("Title", "Text", data, "type")

# 4. Tables
add_table_slide("Title", [["Header1", "Header2"], ["Row1", "Row2"]])
add_table_slide("Title", table_data, "Text Context")
add_table_slide("Title", table_data, "Text", chart_data, "type") # Dashboard

# 5. Finish
add_qa_slide()
add_thank_you_slide()
save_presentation("filename.pptx")
\`\`\`
`;

/**
 * Get PDF document creation instructions  
 * @returns {string} Complete PDF document instructions
 */
function getPDFDocumentInstructions() {
  return `
# TCB PDF Builder Rules

## 🚨 CRITICAL RULES
1. **LIBRARY**: MUST use \`tcb_pdf_builder\`.
2. **CHARTS**: Generate via \`matplotlib\` -> Save as PNG -> PDF Builder auto-detects.
3. **SIZE**: Charts max 800x500px, DPI=200.

## 📚 API REFERENCE
\`\`\`python
from tcb_pdf_builder import *

new_document()
add_title("Title")
add_heading("Header", level=1)
add_paragraph("Text content...")
add_bullet_list(["Item 1", "Item 2"])
add_numbered_list(["Step 1", "Step 2"])
add_table([["H1", "H2"], ["D1", "D2"]])
add_page_break()

# Chart Workflow (PDF Only)
import matplotlib.pyplot as plt
plt.figure(figsize=(8, 5))
plt.plot([1,2], [10,20])
plt.savefig("/mnt/data/chart.png", dpi=200, bbox_inches='tight') 
# Note: No add_image() needed for PDF builder, it finds them.

save_document("filename.pdf")
\`\`\`
`;
}

/**
 * Get Word document creation instructions
 * @returns {string} Complete Word document instructions
 */
function getWordDocumentInstructions() {
  return `
# TCB Word Builder Rules

## 🚨 CRITICAL RULES
1. **LIBRARY**: MUST use \`tcb_word_builder\`.
2. **CHARTS**: Generate via \`matplotlib\` -> Save as PNG -> \`add_image()\`.

## 📚 API REFERENCE
\`\`\`python
from tcb_word_builder import *

new_document()
add_title("Title")
add_heading("Header", level=1)
add_paragraph("Text")
add_bullet_list(["Item 1"])
add_numbered_list(["Step 1"])
add_table([["H1"], ["D1"]])

# Chart Workflow (Word Only)
import matplotlib.pyplot as plt
plt.savefig("/mnt/data/chart.png", dpi=300)
add_image("chart.png", width=6.0, caption="Caption")

save_document("filename.docx")
\`\`\`
`;
}

/**
 * Get available Python packages information
 * @returns {string} List of available packages
 */
function getAvailablePackages() {
  return `
# Python Environment
- **Data**: pandas, numpy, scipy, faker
- **Viz**: matplotlib (use \`plt.style.use('seaborn-v0_8-darkgrid')\`), seaborn, plotly
- **Docs**: texas_capital_builder (PPT), tcb_word_builder (Word), tcb_pdf_builder (PDF)
- **Utils**: requests, beautifulsoup4, pillow
`;
}

/**
 * Get PowerPoint creation instructions
 * @returns {string} Complete PowerPoint instructions
 */
function getPowerPointInstructions() {
  return presentationInstructions;
}

/**
 * Get complete code executor instructions including all document types
 * @returns {string} Complete instructions for code executor
 */
function getCodeExecutorInstructions() {
  return `
# ⛔ CODE EXECUTOR USAGE RESTRICTIONS ⛔

**DO NOT USE CODE EXECUTOR FOR:**
- Dashboards → Use Artifacts (React components)
- Charts/Visualizations for display → Use Artifacts
- Interactive UI components → Use Artifacts
- Mock/sample data generation for visuals → Use Artifacts with inline data
- Any visual output the user will see directly → Use Artifacts

**ONLY USE CODE EXECUTOR FOR:**
- Creating downloadable FILES: PowerPoint (.pptx), Word (.docx), PDF (.pdf), Excel (.xlsx)
- Processing uploaded files (CSV, Excel, PDF parsing)
- Heavy data computation/transformation
- Generating images to EMBED in documents

**CRITICAL: If user asks for a "dashboard", "chart", or "visualization" WITHOUT mentioning a file format, CREATE AN ARTIFACT INSTEAD. Do NOT run Python code.**

---

${getAvailablePackages()}

# DOCUMENT GENERATION RULES

## 1. PowerPoint (Strict)
- **Library**: \`texas_capital_builder\` ONLY.
- **Charts**: Use built-in functions (\`add_chart_slide\`). **NO matplotlib images.**

## 2. Word / PDF (Flexible)
- **Library**: \`tcb_word_builder\` / \`tcb_pdf_builder\`.
- **Charts**: Use \`matplotlib\` to save PNGs, then embed.

${presentationInstructions}
${getWordDocumentInstructions()}
${getPDFDocumentInstructions()}
`;
}

module.exports = {
  getPowerPointInstructions,
  getWordDocumentInstructions,
  getPDFDocumentInstructions,
  getAvailablePackages,
  getCodeExecutorInstructions,
};
