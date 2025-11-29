/**
 * Utility functions for title case conversions
 */

/**
 * Convert language names to proper display format
 * @param language - The language string to convert
 * @returns Properly formatted language name
 */
export const getLanguageDisplay = (language: string): string => {
  const langMap: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    py: 'Python',
    java: 'Java',
    cpp: 'C++',
    csharp: 'C#',
    html: 'HTML',
    css: 'CSS',
    sql: 'SQL',
    json: 'JSON',
    xml: 'XML',
    yaml: 'YAML',
    markdown: 'Markdown',
    bash: 'Bash',
    shell: 'Shell',
    powershell: 'PowerShell',
    php: 'PHP',
    ruby: 'Ruby',
    go: 'Go',
    rust: 'Rust',
    swift: 'Swift',
    kotlin: 'Kotlin',
    dart: 'Dart',
  };
  return langMap[language.toLowerCase()] || language.charAt(0).toUpperCase() + language.slice(1);
};

/**
 * Convert tool/function names to title case by replacing underscores with spaces
 * and capitalizing each word
 * @param str - The string to convert
 * @returns Title case string
 */
export const toTitleCase = (str: string): string => {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};