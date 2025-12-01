/**
 * Parse hex color to RGB
 */
export function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  
  // Remove # if present
  hex = hex.replace(/^#/, '');
  
  // Handle 'auto' or invalid
  if (hex === 'auto' || hex.length !== 6) return null;
  
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  
  return { r, g, b };
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert theme color name to actual color
 * This is simplified - full implementation would need theme.xml parsing
 */
export function resolveThemeColor(
  themeColor: string,
  themeTint?: string,
  themeShade?: string,
  themes?: Map<string, string>
): string | null {
  if (!themes) return null;
  
  let color = themes.get(themeColor);
  if (!color) return null;
  
  // Apply tint or shade if specified
  if (themeTint) {
    const tintValue = parseInt(themeTint, 16) / 255;
    color = applyTint(color, tintValue);
  } else if (themeShade) {
    const shadeValue = parseInt(themeShade, 16) / 255;
    color = applyShade(color, shadeValue);
  }
  
  return color;
}

/**
 * Apply tint to color (lighten)
 */
export function applyTint(color: string, tint: number): string {
  const rgb = parseHexColor(color);
  if (!rgb) return color;
  
  const r = rgb.r + (255 - rgb.r) * tint;
  const g = rgb.g + (255 - rgb.g) * tint;
  const b = rgb.b + (255 - rgb.b) * tint;
  
  return rgbToHex(r, g, b);
}

/**
 * Apply shade to color (darken)
 */
export function applyShade(color: string, shade: number): string {
  const rgb = parseHexColor(color);
  if (!rgb) return color;
  
  const r = rgb.r * (1 - shade);
  const g = rgb.g * (1 - shade);
  const b = rgb.b * (1 - shade);
  
  return rgbToHex(r, g, b);
}

/**
 * Convert color name to hex
 */
const COLOR_NAMES: Record<string, string> = {
  'black': '#000000',
  'white': '#FFFFFF',
  'red': '#FF0000',
  'green': '#00FF00',
  'blue': '#0000FF',
  'yellow': '#FFFF00',
  'cyan': '#00FFFF',
  'magenta': '#FF00FF',
  'darkRed': '#8B0000',
  'darkGreen': '#006400',
  'darkBlue': '#00008B',
  'darkYellow': '#808000',
  'darkCyan': '#008B8B',
  'darkMagenta': '#8B008B',
  'darkGray': '#A9A9A9',
  'lightGray': '#D3D3D3',
};

export function resolveColorName(name: string): string | null {
  return COLOR_NAMES[name] || null;
}

/**
 * Normalize color value to CSS format
 */
export function normalizeColor(
  color?: string,
  themeColor?: string,
  themeTint?: string,
  themeShade?: string,
  themes?: Map<string, string>
): string | undefined {
  if (!color && !themeColor) return undefined;
  
  // Try theme color first
  if (themeColor) {
    const resolved = resolveThemeColor(themeColor, themeTint, themeShade, themes);
    if (resolved) return resolved;
  }
  
  // Handle color value
  if (!color || color === 'auto') return undefined;
  
  // Check if it's a color name
  const namedColor = resolveColorName(color);
  if (namedColor) return namedColor;
  
  // Assume it's hex
  if (color.startsWith('#')) return color;
  return `#${color}`;
}
