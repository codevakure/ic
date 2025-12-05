/**
 * PowerPoint Presentation Instructions for Code Executor
 * Texas Capital Builder - Concise Guide
 */

const presentationInstructions = `
# PowerPoint Creation - Texas Capital Builder

## 🎯 RESPONSE STYLE
- **Professional & user-friendly** - focus on results, not technical details
- **Filename only** (not paths like /mnt/data/)
- **Clean summaries** like GitHub Copilot

## ⭐ TEXAS CAPITAL BUILDER MANDATORY
- **STRICTLY USE Texas Capital Builder** for PowerPoint presentations
- **NEVER use raw libraries** (python-pptx, matplotlib, plotly) for presentations
- **FORBIDDEN**: External chart image generation (\`plt.savefig()\` → \`add_image_slide()\`)
- **REQUIRED**: All charts MUST use Texas Capital Builder's built-in chart engine for PPT

## 🚫 CHART RULES - STRICTLY ENFORCED
- **ONLY USE**: \`add_chart_slide()\`, \`add_large_chart_slide()\`, \`add_text_and_chart_slide()\`, \`add_table_slide()\` with chart_data
- **FORBIDDEN**: matplotlib/plotly for PowerPoint charts
- Charts embedded with proper Texas Capital branding and colors

## QUICK START - PowerPoint
\`\`\`python
from texas_capital_builder import *

new_presentation()
add_title_slide("Title", "Subtitle")
add_content_slide("Agenda", ["Point 1", "Point 2", "Point 3"])
add_qa_slide()
add_thank_you_slide()
save_presentation("presentation.pptx")
\`\`\`

## TEXAS CAPITAL BUILDER - FUNCTION MATRIX

### 📊 CHART FUNCTIONS
| **Function** | **Use Case** | **Chart Types** | **Example** |
|-------------|--------------|------------------|-------------|
| \`add_chart_slide()\` | Full-page charts | bar, line, pie, doughnut | \`add_chart_slide("Revenue", {"Q1": 100, "Q2": 120}, "line")\` |
| \`add_large_chart_slide()\` | Large charts (alias) | bar, line, pie, doughnut | \`add_large_chart_slide("Growth", data, "bar")\` |
| \`add_text_and_chart_slide()\` | Charts + explanatory text | bar, line, pie, doughnut | \`add_text_and_chart_slide("Analysis", "Key insights:", data, "pie")\` |

### 📋 TABLE FUNCTIONS  
| **Function** | **Use Case** | **Example** |
|-------------|--------------|-------------|
| \`add_table_slide(title, table_data)\` | Full-page tables | \`add_table_slide("Data", [["Col1", "Col2"], ["Row1", "Row2"]])\` |
| \`add_table_slide(title, table_data, text)\` | Tables + text | \`add_table_slide("Summary", table_data, "Key findings")\` |
| \`add_table_slide(title, table_data, text, chart_data, chart_type)\` | **Dashboard: Tables + text + chart** | \`add_table_slide("Dashboard", table_data, "Analysis", chart_data, "bar")\` |

### 📝 CONTENT FUNCTIONS
| **Function** | **Use Case** | **Example** |
|-------------|--------------|-------------|
| \`add_content_slide()\` | Bullet point lists | \`add_content_slide("Agenda", ["Point 1", "Point 2"])\` |
| \`add_two_column_slide()\` | Side-by-side comparisons | \`add_two_column_slide("Pros vs Cons", ["Pro 1"], ["Con 1"])\` |
| \`add_quadrants_slide()\` | SWOT, matrices (2x2 grid) | \`add_quadrants_slide("SWOT", tl, tr, bl, br)\` |

### 🖼️ SPECIAL FUNCTIONS
| **Function** | **Use Case** | **Example** |
|-------------|--------------|-------------|
| \`add_image_slide()\` | External images with context | \`add_image_slide("Process", "Our workflow", "/mnt/data/process.png")\` |
| \`add_title_slide()\` | Presentation opener | \`add_title_slide("Q4 Results", "Business Review")\` |
| \`add_qa_slide()\` | Q&A section | \`add_qa_slide()\` |
| \`add_thank_you_slide()\` | Presentation closer | \`add_thank_you_slide()\` |

## 🎯 CHART SPECIFICATIONS
| **Chart Type** | **Best For** | **Data Format** | **Max Categories** |
|----------------|--------------|-----------------|-------------------|
| \`"bar"\` | Comparisons | \`{"Q1": 100, "Q2": 120}\` | Unlimited |
| \`"line"\` | Trends over time | \`{"Jan": 100, "Feb": 120}\` | Unlimited |
| \`"pie"\` | Proportions | \`{"Segment A": 45, "Segment B": 30}\` | **Max 5** |
| \`"doughnut"\` | Proportions (alternative) | \`{"Product A": 8.2, "Product B": 3.2}\` | **Max 5** |

**Multi-Series**: \`{"Q1": [100, 120, 90], "Q2": [110, 130, 95]}\` (arrays for multiple series)

## 📊 DASHBOARD COMBINATIONS
**Advanced Table+Chart Slides**: \`add_table_slide(title, table_data, text_content, chart_data, chart_type)\`
- **Use Case**: Create dashboard-like slides with data table + explanatory text + visualization chart
- **Example**: \`add_table_slide("Performance Dashboard", financial_table, "Key insights:", revenue_chart, "line")\`
- **Layout**: Table on left, text and chart on right (perfect for executive summaries)

## ⚠️ CRITICAL RULES
### 📊 FOR CHARTS → Texas Capital Builder ONLY:
- **✅ CORRECT**: \`add_chart_slide("Revenue", chart_data, "bar")\`
- **❌ FORBIDDEN**: matplotlib/plotly for PowerPoint charts

### 🖼️ FOR IMAGES → External Images Only:  
- **✅ CORRECT**: External photos, diagrams, screenshots
- **❌ FORBIDDEN**: Chart images from matplotlib/plotly

### 📋 FOR TABLES → Structured Data:
- **✅ CORRECT**: \`add_table_slide("Data", table_data)\`
- **✅ DASHBOARD**: \`add_table_slide("Dashboard", table_data, "Analysis", chart_data, "bar")\`

## QUICK WORKFLOW
\`\`\`python
from texas_capital_builder import *

new_presentation()
add_title_slide("Q4 Results", "Business Review")
add_content_slide("Agenda", ["Performance", "Analysis", "Next Steps"])
add_chart_slide("Revenue Growth", {"Q1": 100, "Q2": 120}, "line")
add_table_slide("Summary", [["Quarter", "Revenue"], ["Q1", "$100M"]])
add_qa_slide()
add_thank_you_slide()
save_presentation("q4_results.pptx")
\`\`\`

## COMMON MISTAKES TO AVOID
- ❌ Using matplotlib for PowerPoint charts (use Texas Capital Builder)
- ❌ \`plt.savefig()\` → \`add_image_slide()\` for charts
- ❌ Passing bullets to \`add_table_slide()\`
- ❌ Forgetting \`new_presentation()\` at start
`;

/**
 * Get PDF document creation instructions  
 * @returns {string} Complete PDF document instructions
 */
function getPDFDocumentInstructions() {
  return `
# PDF Document Creation - TCB PDF Builder

## 🎯 PDF DOCUMENTS - FLEXIBLE CHART POLICY
- **TCB PDF Builder PREFERRED** for document structure and formatting
- **CHART IMAGES ALLOWED**: Can use matplotlib/plotly charts saved as images
- **Workflow**: Generate chart → save image → reference in text (auto-handled)

## ⚠️ CRITICAL: USE EXACT FUNCTION NAMES
**NEVER confuse with PowerPoint functions!** PDF builder has different function names.

## QUICK START
\`\`\`python
from tcb_pdf_builder import *

new_document()
add_title("Quarterly Report")
add_heading("Financial Overview", 1)
add_paragraph("The financial results show significant growth...")
add_bullet_list(["Revenue up 15%", "Costs down 5%"])

# Charts allowed as images in PDF - KEEP IMAGES SMALL
import matplotlib.pyplot as plt
plt.figure(figsize=(8, 5))  # SMALLER SIZE to avoid layout errors
plt.bar(['Q1', 'Q2', 'Q3', 'Q4'], [100, 120, 140, 160])
plt.title("Quarterly Revenue")
plt.savefig("/mnt/data/quarterly_chart.png", dpi=200, bbox_inches='tight')  # LOWER DPI
# PDF builder handles image insertion automatically

save_document("report.pdf")
\`\`\`

## FUNCTION REFERENCE - EXACT NAMES ONLY
| **Function** | **Parameters** | **Example** | **Use When** |
|-------------|----------------|-------------|--------------|
| \`new_document()\` | None | \`new_document()\` | Start PDF |
| \`add_title()\` | \`title\` | \`add_title("Annual Report")\` | Document title |
| \`add_heading()\` | \`heading, level=1\` | \`add_heading("Summary", 1)\` | Section headers (1-3) |
| \`add_paragraph()\` | \`text\` | \`add_paragraph("Content...")\` | Body text |
| \`add_bullet_list()\` | \`items\` | \`add_bullet_list(["Point 1", "Point 2"])\` | Bullet lists |
| \`add_numbered_list()\` | \`items\` | \`add_numbered_list(["Step 1", "Step 2"])\` | Numbered lists |
| \`add_table()\` | \`table_data\` | \`add_table([["H1", "H2"], ["Data1", "Data2"]])\` | Tables |
| \`add_page_break()\` | None | \`add_page_break()\` | Force new page |
| \`save_document()\` | \`filename\` | \`save_document("report.pdf")\` | Save file |

## ❌ FUNCTIONS THAT DON'T EXIST IN PDF BUILDER:
- **❌ add_two_column_section()** - DOES NOT EXIST
- **❌ add_content_slide()** - PowerPoint only
- **❌ add_chart_slide()** - PowerPoint only
- **❌ Any function with "slide" in name** - PowerPoint only
- **❌ add_image()** - Images handled automatically, not manual insertion

## 🔧 PDF IMAGE HANDLING:
- **Auto-Detection**: PDF builder automatically finds images in /mnt/data/
- **Size Limits**: Keep charts under **800x500 pixels** to avoid "too large" errors
- **DPI Setting**: Use **dpi=200** (not 300) to reduce file size
- **Format**: Use PNG format for best compatibility
- **No Manual Insertion**: Images referenced automatically, don't call add_image()

## 📏 CHART SIZE GUIDELINES FOR PDF:
\`\`\`python
# ✅ CORRECT - Small size to fit PDF pages
plt.figure(figsize=(8, 5))  
plt.savefig("/mnt/data/chart.png", dpi=200, bbox_inches='tight')

# ❌ WRONG - Too large, causes "too large on page" error  
plt.figure(figsize=(12, 8))
plt.savefig("/mnt/data/chart.png", dpi=300)
\`\`\`
`;
}

/**
 * Get Word document creation instructions
 * @returns {string} Complete Word document instructions
 */
function getWordDocumentInstructions() {
  return `
# Word Document Creation - TCB Word Builder

## 🎯 WORD DOCUMENTS - FLEXIBLE CHART POLICY
- **TCB Word Builder PREFERRED** for document structure and formatting
- **CHART IMAGES ALLOWED**: Can use matplotlib/plotly charts saved as images
- **Workflow**: Generate chart → save image → \`add_image("chart.png")\`

## ⚠️ CRITICAL: USE EXACT FUNCTION NAMES
**NEVER confuse with PowerPoint functions!** Word/PDF have different function names.

## QUICK START
\`\`\`python
from tcb_word_builder import *

new_document()
add_title("Annual Report 2024")
add_heading("Executive Summary", 1)
add_paragraph("This report summarizes our key findings...")
add_bullet_list(["Revenue increased 15%", "Market share grew"])

# Charts allowed as images in Word
import matplotlib.pyplot as plt
plt.figure(figsize=(8, 6))
plt.plot([1, 2, 3, 4], [10, 15, 12, 18])
plt.title("Revenue Growth")
plt.savefig("/mnt/data/revenue_chart.png", dpi=300, bbox_inches='tight')
add_image("revenue_chart.png", width=6.0, caption="Revenue Growth Over Time")

save_document("report.docx")
\`\`\`

## FUNCTION REFERENCE - EXACT NAMES ONLY
| **Function** | **Parameters** | **Example** | **Use When** |
|-------------|----------------|-------------|--------------|
| \`new_document()\` | None | \`new_document()\` | Start document |
| \`add_title()\` | \`title\` | \`add_title("Annual Report")\` | Document title |
| \`add_heading()\` | \`heading, level=1\` | \`add_heading("Summary", 1)\` | Section headers (1-3) |
| \`add_paragraph()\` | \`text\` | \`add_paragraph("Content...")\` | Body text |
| \`add_bullet_list()\` | \`items\` | \`add_bullet_list(["Point 1", "Point 2"])\` | Bullet points |
| \`add_numbered_list()\` | \`items\` | \`add_numbered_list(["Step 1", "Step 2"])\` | Numbered lists |
| \`add_table()\` | \`table_data\` | \`add_table([["H1", "H2"], ["Data1", "Data2"]])\` | Tables |
| \`add_image()\` | \`filename, width=6.0, caption=""\` | \`add_image("chart.png", width=6.0)\` | Images/charts |
| \`add_page_break()\` | None | \`add_page_break()\` | Force new page |
| \`save_document()\` | \`filename\` | \`save_document("report.docx")\` | Save file |

## ❌ FUNCTIONS THAT DON'T EXIST IN WORD BUILDER:
- **❌ add_two_column_section()** - DOES NOT EXIST
- **❌ add_content_slide()** - PowerPoint only
- **❌ add_chart_slide()** - PowerPoint only
- **❌ Any function with "slide" in name** - PowerPoint only

## 📏 IMAGE SIZE GUIDELINES FOR WORD:
- **width=6.0** - Full page width
- **width=4.0** - Medium image  
- **width=3.0** - Small image
- Keep images under **800x600 pixels** to avoid layout issues
`;
}

/**
 * Get available Python packages information
 * @returns {string} List of available packages
 */
function getAvailablePackages() {
  return `
# Available Python Packages for Code Execution

## CORE DATA SCIENCE LIBRARIES:
- **NumPy**: Numerical computing and array operations
- **Pandas**: Data manipulation and analysis
- **Matplotlib**: Static plotting and visualization - use 'seaborn-v0_8-darkgrid' style, NOT 'seaborn'
- **Seaborn**: Statistical data visualization
- **SciPy**: Scientific computing and statistics
- **Plotly**: Interactive plotting and visualization
- **Faker**: Generate fake data for testing

## MATPLOTLIB STYLE USAGE (IMPORTANT):
- ✅ **CORRECT**: \`plt.style.use('seaborn-v0_8-darkgrid')\` or \`plt.style.use('ggplot')\`
- ❌ **DEPRECATED**: \`plt.style.use('seaborn')\` - Will cause errors in newer matplotlib versions
- **Available styles**: seaborn-v0_8, seaborn-v0_8-darkgrid, seaborn-v0_8-whitegrid, ggplot, default

## DOCUMENT AND OFFICE AUTOMATION:
- **Texas Capital Builder**: ⭐ **PREFERRED** for PowerPoint presentations - Custom template system with branding
- **python-pptx**: PowerPoint file creation - Use only when Texas Capital Builder is insufficient
- **openpyxl**: Excel file creation and editing
- **xlsxwriter**: Excel file writing
- **python-docx**: Word document automation
- **ReportLab**: PDF generation and creation
- **PyPDF2**: PDF file processing
- **pdfplumber**: PDF text extraction

## IMAGE PROCESSING:
- **Pillow (PIL)**: Image processing and manipulation

## ⚠️ BLOCKED LIBRARIES (DO NOT USE - Internet is disabled):
- **requests**: ❌ BLOCKED - Cannot make HTTP requests
- **beautifulsoup4**: ❌ BLOCKED - Web scraping not available
- **urllib.request**: ❌ BLOCKED - URL fetching disabled
- **httpx, aiohttp, httplib2**: ❌ BLOCKED - All HTTP libraries blocked

## BUILT-IN PYTHON LIBRARIES (Always Available):
- **pathlib**: Modern path handling
- **csv**: CSV file processing
- **json**: JSON data processing
- **datetime**: Date and time operations
- **os**: Operating system interface
- **glob**: File pattern matching
- **shutil**: High-level file operations
- **urllib**: URL handling utilities

## NOTES:
- All listed packages are pre-installed and ready to use
- No pip install commands needed for available packages
- Matplotlib automatically uses 'Agg' backend for file generation
- Files save to current working directory and copy to /mnt/data for downloads
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
  return `${getAvailablePackages()}

# ⛔ CRITICAL: NETWORK ACCESS IS COMPLETELY BLOCKED

## 🚫 INTERNET/API ACCESS FORBIDDEN
The code execution environment has **NO INTERNET ACCESS**. All network calls are blocked at multiple levels.

**BLOCKED OPERATIONS:**
- ❌ HTTP/HTTPS requests (requests, urllib, httpx, aiohttp)
- ❌ API calls to external services
- ❌ Web scraping (beautifulsoup4 + requests)
- ❌ Downloading files from URLs
- ❌ WebSocket connections
- ❌ Any socket-based network operations
- ❌ gRPC calls

**IF YOU SEE "NETWORK_BLOCKED" ERROR:**
- **DO NOT RETRY** the same code - it will fail again
- **DO NOT** try alternative HTTP libraries - all are blocked
- **INSTEAD**: Inform the user that internet access is not available
- **SOLUTION**: Work only with locally uploaded files or generate data locally

**WHAT TO DO INSTEAD:**
- ✅ Use files that have been uploaded by the user
- ✅ Generate sample/mock data locally if no data is available
- ✅ Ask the user to upload the data file instead of fetching from URL
- ✅ Work with data already in the session

**EXAMPLE RESPONSE WHEN NETWORK IS NEEDED:**
"I cannot fetch data from that URL because internet access is disabled in the code execution environment. Please upload the data file directly, and I'll be happy to analyze it for you."

# DOCUMENT CREATION GUIDELINES

## 🔥 TEXAS CAPITAL BUILDER PREFERENCE (ALL DOCUMENT TYPES):
**ALWAYS use Texas Capital Builder libraries for professional business documents:**
- **PowerPoint Presentations**: Texas Capital Builder (\`from texas_capital_builder import *\`)
- **Word Documents**: TCB Word Builder (\`from tcb_word_builder import *\`)  
- **PDF Documents**: TCB PDF Builder (\`from tcb_pdf_builder import *\`)

These provide pre-built Texas Capital formatting, branding, and simplified business-focused APIs.

${getPowerPointInstructions()}

${getWordDocumentInstructions()}

${getPDFDocumentInstructions()}

## 🎯 SUPPORTED IMAGE FORMATS:
- **PNG**: Best for charts, screenshots, graphics with transparency
- **JPG/JPEG**: Best for photographs, complex images
- **GIF**: Supported but not recommended for business documents

## 📁 FILE MANAGEMENT:
- **Save location**: Files auto-saved to /mnt/data for user download
- **Naming**: Use descriptive filenames (e.g., 'quarterly_report.docx', 'sales_presentation.pptx')
- **Multiple formats**: Can generate same content in multiple formats if requested

**IMPORTANT**: ALWAYS prefer Texas Capital Builder libraries over raw python-pptx, python-docx, or reportlab for consistent branding and simplified APIs.`;
}

module.exports = {
  getPowerPointInstructions,
  getWordDocumentInstructions,
  getPDFDocumentInstructions,
  getAvailablePackages,
  getCodeExecutorInstructions,
};
