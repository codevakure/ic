import {isFontAvailable} from '../../../util/isFontAvailable';

const FontAvailableCache = new Map<string, boolean>();

/**
 */
export function checkFont(font: string) {
  if (FontAvailableCache.has(font)) {
    return FontAvailableCache.get(font);
  }
  const result = isFontAvailable(font);
  FontAvailableCache.set(font, result);
  return result;
}

/**
 */
export function getAllNotAvailableFont(): string[] {
  return Array.from(FontAvailableCache.entries())
    .filter(([_, v]) => v === false)
    .map(([k]) => k);
}
