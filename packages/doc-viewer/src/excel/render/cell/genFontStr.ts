import {FontStyle} from '../../types/FontStyle';
import {IRPrElt} from '../../types/IRPrElt';
import {checkFont} from './checkFont';

/**
 * @param fontStyle
 */
export function genFontStr(fontStyle: FontStyle): string {
  let font = '';
  let family = fontStyle.family;

  checkFont(family);

  if (fontStyle.b) {
    font += 'bold ';
  }
  if (fontStyle.i) {
    font += 'italic ';
  }

  // [comment removed]

  // [comment removed]
  if (fontStyle.size) {
    font += `${fontStyle.size * 1.333}px `;
  }

  font += family;
  return font;
}

/**
 */
export function rPrToFontStyle(rPr: IRPrElt) {
  let fontStyle: Partial<FontStyle> = {};
  if (rPr.b) {
    fontStyle.b = true;
  }
  if (rPr.i) {
    fontStyle.i = true;
  }
  if (rPr.sz) {
    fontStyle.size = rPr.sz;
  }
  if (rPr.rFont) {
    fontStyle.family = rPr.rFont;
  }
  return fontStyle;
}

/**
 */
export function mergeRPrWithDefaultFont(rPr: IRPrElt, defaultFont: FontStyle) {
  const fontStyle = rPrToFontStyle(rPr);
  return {
    ...defaultFont,
    ...fontStyle
  };
}

/**
 */
export function genFontStrFromRPr(rPr: IRPrElt, defaultFont: FontStyle) {
  // [comment removed]
  return genFontStr(mergeRPrWithDefaultFont(rPr, defaultFont));
}
