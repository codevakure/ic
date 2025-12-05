// VS Code Dark Modern theme colors for syntax highlighting
// Used across both Sandpack (artifact panels) and highlight.js (inline chat)

export const vscodeTheme = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  
  // Syntax colors
  keyword: '#569cd6',        // blue - keywords, import, export, function, class
  string: '#ce9178',         // orange - strings, template literals
  number: '#b5cea8',         // light green - numbers
  comment: '#6a9955',        // green - comments
  operator: '#d4d4d4',       // white - operators, punctuation
  function: '#dcdcaa',       // yellow - function names
  variable: '#9cdcfe',       // light blue - variables, properties
  type: '#4ec9b0',          // teal - types, interfaces
  constant: '#4fc1ff',      // cyan - constants, enum values
  
  // UI colors
  selection: '#264f78',
  lineHighlight: '#2a2d2e',
  border: '#454545',
  
  // Error states
  error: '#f44747',
  warning: '#ffcc02',
  info: '#75beff'
};

// Light theme colors for syntax highlighting
export const vscodeLightTheme = {
  background: '#efefef',     // matches --gray-98 (--surface-primary-alt light)
  foreground: '#212121',     // matches --gray-800
  
  // Syntax colors (VS Code Light+ inspired)
  keyword: '#0000ff',        // blue - keywords
  string: '#a31515',         // dark red - strings
  number: '#098658',         // green - numbers
  comment: '#008000',        // green - comments
  operator: '#000000',       // black - operators
  function: '#795e26',       // brown - function names
  variable: '#001080',       // dark blue - variables, properties
  type: '#267f99',           // teal - types, interfaces
  constant: '#0070c1',       // blue - constants
  
  // UI colors
  selection: '#add6ff',
  lineHighlight: '#f0f0f0',
  border: '#e3e3e3',
  
  // Error states
  error: '#d32f2f',
  warning: '#e65100',
  info: '#1976d2'
};

// Sandpack theme object for artifact panels - Dark mode
export const sandpackVscodeTheme = {
  colors: {
    surface1: '#171717', // matches --gray-850 (--surface-primary-alt dark)
    surface2: '#171717',
    surface3: '#171717',
    clickable: vscodeTheme.foreground,
    base: vscodeTheme.foreground,
    disabled: '#6a6a6a',
    hover: '#37373d',
    accent: vscodeTheme.keyword,
    error: vscodeTheme.error,
    errorSurface: '#5a1d1d',
  },
  syntax: {
    plain: vscodeTheme.foreground,
    comment: { color: vscodeTheme.comment, fontStyle: 'italic' as const },
    keyword: { color: vscodeTheme.keyword },
    tag: { color: vscodeTheme.keyword },
    punctuation: { color: vscodeTheme.operator },
    definition: { color: vscodeTheme.function },
    property: { color: vscodeTheme.variable },
    static: { color: vscodeTheme.constant },
    string: { color: vscodeTheme.string },
    number: { color: vscodeTheme.number },
  },
  font: {
    body: 'Consolas, Monaco, "Courier New", monospace, Menlo, monospace',
    mono: 'Consolas, Monaco, "Courier New", monospace, Menlo, monospace',
    size: '13px',
    lineHeight: '20px'
  }
};

// Sandpack theme object for artifact panels - Light mode
export const sandpackVscodeLightTheme = {
  colors: {
    surface1: '#efefef', // matches --gray-98 (--surface-primary-alt light)
    surface2: '#efefef',
    surface3: '#efefef',
    clickable: vscodeLightTheme.foreground,
    base: vscodeLightTheme.foreground,
    disabled: '#999696',
    hover: '#e3e3e3',
    accent: vscodeLightTheme.keyword,
    error: vscodeLightTheme.error,
    errorSurface: '#ffebee',
  },
  syntax: {
    plain: vscodeLightTheme.foreground,
    comment: { color: vscodeLightTheme.comment, fontStyle: 'italic' as const },
    keyword: { color: vscodeLightTheme.keyword },
    tag: { color: vscodeLightTheme.keyword },
    punctuation: { color: vscodeLightTheme.operator },
    definition: { color: vscodeLightTheme.function },
    property: { color: vscodeLightTheme.variable },
    static: { color: vscodeLightTheme.constant },
    string: { color: vscodeLightTheme.string },
    number: { color: vscodeLightTheme.number },
  },
  font: {
    body: 'Consolas, Monaco, "Courier New", monospace, Menlo, monospace',
    mono: 'Consolas, Monaco, "Courier New", monospace, Menlo, monospace',
    size: '13px',
    lineHeight: '20px'
  }
};

// CSS variables for highlight.js (inline chat)
export const highlightJsVariables = {
  '--hljs-bg': vscodeTheme.background,
  '--hljs-color': vscodeTheme.foreground,
  '--hljs-keyword': vscodeTheme.keyword,
  '--hljs-string': vscodeTheme.string,
  '--hljs-number': vscodeTheme.number,
  '--hljs-comment': vscodeTheme.comment,
  '--hljs-operator': vscodeTheme.operator,
  '--hljs-function': vscodeTheme.function,
  '--hljs-variable': vscodeTheme.variable,
  '--hljs-type': vscodeTheme.type,
  '--hljs-constant': vscodeTheme.constant,
  '--hljs-selection': vscodeTheme.selection,
  '--hljs-line-highlight': vscodeTheme.lineHighlight,
  '--hljs-border': vscodeTheme.border,
  '--hljs-error': vscodeTheme.error,
};

// Generate CSS custom properties
export const generateHighlightCss = () => `
:root {
  ${Object.entries(highlightJsVariables)
    .map(([key, value]) => `${key}: ${value};`)
    .join('\n  ')}
}

/* VS Code Dark Modern theme for highlight.js */
.dark .hljs {
  background: var(--hljs-bg) !important;
  color: var(--hljs-color) !important;
}

.dark .hljs-keyword,
.dark .hljs-selector-tag,
.dark .hljs-literal,
.dark .hljs-section,
.dark .hljs-link {
  color: var(--hljs-keyword) !important;
}

.dark .hljs-string,
.dark .hljs-title,
.dark .hljs-name,
.dark .hljs-type,
.dark .hljs-attribute,
.dark .hljs-symbol,
.dark .hljs-bullet,
.dark .hljs-addition,
.dark .hljs-variable,
.dark .hljs-template-tag,
.dark .hljs-template-variable {
  color: var(--hljs-string) !important;
}

.dark .hljs-comment,
.dark .hljs-quote,
.dark .hljs-deletion,
.dark .hljs-meta {
  color: var(--hljs-comment) !important;
}

.dark .hljs-number {
  color: var(--hljs-number) !important;
}

.dark .hljs-function .hljs-title,
.dark .hljs-title.hljs-function {
  color: var(--hljs-function) !important;
}

.dark .hljs-attr,
.dark .hljs-property {
  color: var(--hljs-variable) !important;
}

.dark .hljs-class .hljs-title,
.dark .hljs-title.hljs-class {
  color: var(--hljs-type) !important;
}

.dark .hljs-built_in,
.dark .hljs-constant {
  color: var(--hljs-constant) !important;
}
`;