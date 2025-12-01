import {
  ST_HorizontalAlignment,
  ST_VerticalAlignment
} from '../../../openxml/ExcelTypes';
import {isValidURL} from '../../../util/isValidURL';
import {FontStyle} from '../../types/FontStyle';
import {LinkPosition} from './LinkPosition';
import {measureTextWithCache} from './measureTextWithCache';
import {genFontStr} from './genFontStr';

const debugFontBoundingBox = false;

/**
 * @param fontStyle
 * @param text
 * @param color
 * @param x
 * @param y
 * @param width
 * @param height
 * @param horizontal
 * @param vertical
 */
export function drawSingleLineText(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  fontStyle: FontStyle,
  text: string,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number,
  intent: number,
  horizontal: ST_HorizontalAlignment,
  vertical: ST_VerticalAlignment,
  linkPositionCache: LinkPosition[] = []
) {
  const font = genFontStr(fontStyle);
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  let textWidth = 0;
  let drawX = x + intent;
  let textHeight = 0;
  if (horizontal === 'right') {
    const size = measureTextWithCache(ctx, font, text);
    textWidth = size.width;
    textHeight = size.height;
    drawX = x + width - textWidth;
  }
  if (horizontal === 'center') {
    const size = measureTextWithCache(ctx, font, text);
    textWidth = size.width;
    textHeight = size.height;
    drawX = x + (width - textWidth) / 2;
  }
  // [comment removed]
  let drawY = y + height / 2;

  if (vertical === 'bottom') {
    drawY = y + height;
    ctx.textBaseline = 'bottom';
  }
  if (vertical === 'top') {
    drawY = y;
    ctx.textBaseline = 'top';
  }

  ctx.fillText(text, drawX, drawY);

  if (debugFontBoundingBox) {
    ctx.strokeStyle = '#ff0000';
    ctx.strokeRect(drawX, drawY, textWidth, textHeight);
  }

  if (isValidURL(text)) {
    const size = measureTextWithCache(ctx, font, text);
    // [comment removed]
    let realY = drawY - size.height / 2;
    if (vertical === 'bottom') {
      realY = drawY - size.height;
    }
    if (vertical === 'top') {
      realY = drawY;
    }
    linkPositionCache.push({
      url: text,
      pos: [
        {
          x: drawX,
          y: realY,
          width: size.width,
          height: size.height
        }
      ]
    });
  }
}
