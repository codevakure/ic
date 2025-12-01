/**
 * Convert EMU (English Metric Units) to pixels
 * 1 inch = 914400 EMU
 * 1 inch = 96 pixels (at 96 DPI)
 */
export function emuToPx(emu: number | string): number {
  const emuValue = typeof emu === 'string' ? parseInt(emu, 10) : emu;
  if (isNaN(emuValue)) return 0;
  return emuValue / 914400 * 96;
}

/**
 * Convert pixels to EMU
 */
export function pxToEmu(px: number): number {
  return px * 914400 / 96;
}

/**
 * Convert points to pixels
 * 1 point = 1/72 inch
 * 1 inch = 96 pixels
 */
export function ptToPx(pt: number | string): number {
  const ptValue = typeof pt === 'string' ? parseFloat(pt) : pt;
  if (isNaN(ptValue)) return 0;
  return ptValue * 96 / 72;
}

/**
 * Convert pixels to points
 */
export function pxToPt(px: number): number {
  return px * 72 / 96;
}

/**
 * Convert twips to pixels
 * 1 twip = 1/20 point
 * 1 twip = 1/1440 inch
 */
export function twipToPx(twip: number | string): number {
  const twipValue = typeof twip === 'string' ? parseInt(twip, 10) : twip;
  if (isNaN(twipValue)) return 0;
  return twipValue / 1440 * 96;
}

/**
 * Convert pixels to twips
 */
export function pxToTwip(px: number): number {
  return px * 1440 / 96;
}

/**
 * Convert DXA (twentieth of a point) to pixels
 * 1 DXA = 1/20 point
 */
export function dxaToPx(dxa: number | string): number {
  const dxaValue = typeof dxa === 'string' ? parseInt(dxa, 10) : dxa;
  if (isNaN(dxaValue)) return 0;
  return twipToPx(dxaValue);
}

/**
 * Convert half-points to pixels
 * Used for font sizes in OOXML (2 half-points = 1 point)
 */
export function halfPtToPx(halfPt: number | string): number {
  const value = typeof halfPt === 'string' ? parseInt(halfPt, 10) : halfPt;
  if (isNaN(value)) return 0;
  return ptToPx(value / 2);
}

/**
 * Convert percentage to decimal
 */
export function percentToDecimal(percent: string): number {
  if (!percent) return 0;
  const value = parseFloat(percent.replace('%', ''));
  return value / 100;
}

/**
 * Convert eighth-points to pixels
 * Used for borders in OOXML
 */
export function eighthPtToPx(eighthPt: number | string): number {
  const value = typeof eighthPt === 'string' ? parseInt(eighthPt, 10) : eighthPt;
  if (isNaN(value)) return 0;
  return ptToPx(value / 8);
}
