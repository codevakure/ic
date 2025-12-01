import {
  ST_HorizontalAlignment,
  ST_VerticalAlignment
} from '../../../openxml/ExcelTypes';
import {isValidURL} from '../../../util/isValidURL';
import {Sheet} from '../../sheet/Sheet';
import {FontStyle} from '../../types/FontStyle';
import {IDataProvider} from '../../types/IDataProvider';
import type {ExcelRender} from '../ExcelRender';
import {Rect} from '../Rect';
import {LinkPosition} from './LinkPosition';

import {WrapLine} from './autoWrapText';
import {genFontStr, genFontStrFromRPr} from './genFontStr';

const debugFontBoundingBox = false;

export function drawMultiLineText(
  excelRender: ExcelRender,
  sheet: Sheet,
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  dataProvider: IDataProvider,
  fontStyle: FontStyle,
  lines: WrapLine[],
  x: number,
  y: number,
  width: number,
  height: number,
  padding: number,
  horizontal: ST_HorizontalAlignment,
  vertical: ST_VerticalAlignment,
  text: string,
  row: number,
  linkPositionCache: LinkPosition[] = []
) {
  // [comment removed]
  ctx.textBaseline = 'alphabetic';

  const defaultFontHeight = dataProvider.getDefaultFontSize().height;

  const textPositions: Rect[] = [];

  const totalLineHeight = lines.reduce((acc, line) => {
    return acc + (line.maxHeight || defaultFontHeight);
  }, 0);
  // [comment removed]
  let currentY = y + (height - totalLineHeight) / 2;
  if (vertical === 'bottom') {
    currentY = y + height - totalLineHeight;
  } else if (vertical === 'top') {
    currentY = y;
  }
  // [comment removed]
  let textHeight = 0;
  // [comment removed]
  let lineNumber = 0;
  for (const line of lines) {
    lineNumber++;
    const tokens = line.tokens;
    // [comment removed]
    let currentX = x;
    let totalLineWidth = tokens.reduce((acc, token) => {
      return acc + (token.w || 0);
    }, 0);

    if (horizontal === 'center') {
      currentX = x + (width - totalLineWidth) / 2;
    } else if (horizontal === 'right') {
      currentX = x + width - totalLineWidth;
    }
    for (const token of tokens) {
      const font = genFontStr(fontStyle);
      ctx.font = font;
      ctx.fillStyle = fontStyle.color;
      if (token.rPr && Object.keys(token.rPr).length > 0) {
        const font = genFontStrFromRPr(token.rPr, fontStyle);
        ctx.font = font;
        if (token.rPr.color) {
          ctx.fillStyle = dataProvider.getColor(token.rPr.color);
        }
      }
      const fontHeight = line.maxHeight || defaultFontHeight;
      if (debugFontBoundingBox) {
        ctx.strokeStyle = '#ff0000';
        ctx.strokeRect(currentX, currentY, token.w || 0, fontHeight);
      }
      ctx.fillText(token.t, currentX, currentY + fontHeight);
      textPositions.push({
        x: currentX,
        y: currentY,
        width: token.w || 0,
        height: fontHeight
      });
      // [comment removed]
      currentX = currentX + (token.w || 0);
    }
    const lineHeight = line.maxHeight || defaultFontHeight;
    textHeight += lineHeight;
    currentY = currentY + lineHeight;
  }

  // [comment removed]
  // [comment removed]
  const threadHold = 4;
  if (Math.floor(totalLineHeight - threadHold) > height + padding * 2) {
    sheet.setRowHeight(row, totalLineHeight + padding * 2);
    excelRender.setNeedReDraw();
  }

  if (isValidURL(text)) {
    linkPositionCache.push({
      url: text,
      pos: textPositions
    });
  }
}
