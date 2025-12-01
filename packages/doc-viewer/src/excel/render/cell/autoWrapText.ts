/**
 */

import {stringToArray} from '../../../util/stringToArray';
import {FontStyle} from '../../types/FontStyle';

import {IRElt} from '../../types/IRElt';
import {genFontStr, genFontStrFromRPr} from './genFontStr';
import {measureTextWithCache} from './measureTextWithCache';
import {Token, tokenizer} from './tokenizer';

/**
 */
export interface WrapLine {
  tokens: Token[];
  /**
   */
  maxHeight: number;
}

/**
 * @param ctx canvas context
 */
export function autoWrapText(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string | IRElt[],
  width: number,
  fontStyle: FontStyle
) {
  ctx.save();

  let tokens: Token[] = [];
  const lines: WrapLine[] = [];

  if (typeof text === 'string') {
    tokens = tokenizer(text);
  } else {
    for (const t of text) {
      const newTokens = tokenizer(t.t);
      newTokens.forEach(token => {
        token.rPr = t.rPr;
      });
      tokens = tokens.concat(newTokens);
    }
  }
  // [comment removed]
  if (tokens.length > 1000) {
    tokens = tokens.slice(0, 1000);
  }
  const defaultFont = genFontStr(fontStyle);
  let currentWidth = 0;
  // [comment removed]
  const defaultSize = measureTextWithCache(ctx, defaultFont, '1');
  const defaultFontHeight = defaultSize.fontHeight;
  let currentMaxHeight = defaultFontHeight;
  let currentToken: Token[] = [];

  function pushToken(newToken?: Token) {
    lines.push({
      tokens: currentToken,
      maxHeight: currentMaxHeight
    });
    if (newToken) {
      currentToken = [newToken];
    } else {
      currentToken = [];
    }

    currentWidth = 0;
    currentMaxHeight = defaultFontHeight;
  }
  for (const token of tokens) {
    let font = defaultFont;
    if (token.type === 'br') {
      pushToken();
      continue;
    }
    if (token.rPr && Object.keys(token.rPr).length > 0) {
      font = genFontStrFromRPr(token.rPr, fontStyle);
    }
    const size = measureTextWithCache(ctx, font, token.t);

    const tokenWidth = size.width;
    // [comment removed]
    const tokenFontHeight = size.fontHeight;
    token.w = tokenWidth;
    if (tokenFontHeight > currentMaxHeight) {
      currentMaxHeight = tokenFontHeight;
    }

    // [comment removed]
    if (tokenWidth > width) {
      let currentText = '';
      // [comment removed]
      let currentSplitWidth = 0;
      for (const char of stringToArray(token.t)) {
        // [comment removed]
        const charSize = measureTextWithCache(ctx, font, char);
        const charWidth = charSize.width;
        if (currentWidth + charWidth > width) {
          const splitToken = {
            ...token,
            w: currentSplitWidth,
            t: currentText
          };
          currentToken.push(splitToken);
          // [comment removed]
          pushToken();
          currentText = char;
          currentWidth = charWidth;
          currentSplitWidth = charWidth;
          currentMaxHeight = currentMaxHeight;
        } else {
          currentWidth += charWidth;
          currentSplitWidth += charWidth;
          currentText += char;
        }
      }
      if (currentText) {
        const splitToken = {
          ...token,
          w: currentSplitWidth,
          t: currentText
        };
        currentToken.push(splitToken);
      }
    } else if (currentWidth + tokenWidth > width) {
      pushToken(token);
    } else {
      currentWidth += size.width;
      currentToken.push(token);
    }
  }
  if (currentToken.length) {
    lines.push({
      tokens: currentToken,
      maxHeight: currentMaxHeight
    });
  }

  ctx.restore();
  return lines;
}
