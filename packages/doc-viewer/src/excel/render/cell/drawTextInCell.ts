import {
  ST_HorizontalAlignment,
  ST_VerticalAlignment
} from '../../../openxml/ExcelTypes';
import {isValidURL} from '../../../util/isValidURL';
import {Sheet} from '../../sheet/Sheet';
import {CellInfo} from '../../types/CellInfo';
import {IDataProvider} from '../../types/IDataProvider';
import {IRElt} from '../../types/IRElt';
import {ExcelRender} from '../ExcelRender';
import {LinkPosition} from './LinkPosition';
import {WrapLine, autoWrapText} from './autoWrapText';
import {measureTextWithCache} from './measureTextWithCache';
import {drawMultiLineText} from './drawMultiLineText';
import {drawSingleLineRichText} from './drawSingleLineRichText';
import {drawSingleLineText} from './drawSingleLineText';
import {genFontStr} from './genFontStr';

const NUMBER_RE = /^-?[\d\.]+$/;

/**
 * @param cellInfo
 * @param x
 * @param y
 */
export function drawTextInCell(
  excelRender: ExcelRender,
  sheet: Sheet,
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  dataProvider: IDataProvider,
  cellInfo: CellInfo,
  x: number,
  y: number,
  width: number,
  height: number,
  indentSize: number,
  padding: number,
  linkPositionCache: LinkPosition[] = []
) {
  if (
    cellInfo.cellData &&
    typeof cellInfo.cellData === 'object' &&
    cellInfo.cellData.type === 'blank'
  ) {
    return;
  }

  let wrapText = false;
  let horizontal: ST_HorizontalAlignment = 'left';

  // [comment removed]
  if (typeof cellInfo.cellData === 'string') {
    if (NUMBER_RE.test(cellInfo.cellData)) {
      horizontal = 'right';
    }
  }

  // [comment removed]
  let vertical: ST_VerticalAlignment = 'bottom';

  const alignment = cellInfo.alignment;

  // [comment removed]
  let indent = 0;

  let displayWidth = width - padding * 2;

  const fontStyle = dataProvider.getFontStyle(cellInfo.font);

  if (alignment) {
    if (alignment.wrapText) {
      wrapText = true;
    }
    if (alignment.horizontal) {
      horizontal = alignment.horizontal;
    }
    if (alignment.vertical) {
      vertical = alignment.vertical;
    }
    if (alignment.indent) {
      indent = alignment.indent;
    }
    if (alignment.textRotation) {
      // [comment removed]
      if (alignment.textRotation === 255) {
        wrapText = true;
        const defaultFont = genFontStr(fontStyle);
        const defaultFontSize = measureTextWithCache(ctx, defaultFont, '1');
        // [comment removed]
        displayWidth = defaultFontSize.width;
      }
    }
  }

  // [comment removed]
  if (indent > 5) {
    indent = 5;
  }

  // [comment removed]
  const needClip = cellInfo.needClip || horizontal === 'fill' || wrapText;

  if (needClip) {
    ctx.save();
    ctx.rect(x, y, width, height);
    ctx.clip();
  }

  // [comment removed]
  if (wrapText) {
    let lines: WrapLine[] = [];
    if (cellInfo.text) {
      lines = autoWrapText(ctx, cellInfo.text, displayWidth, fontStyle);
    } else if (
      typeof cellInfo.cellData === 'object' &&
      'richText' in cellInfo.cellData
    ) {
      lines = autoWrapText(
        ctx,
        cellInfo.cellData.richText as IRElt[],
        displayWidth,
        fontStyle
      );
    } else {
      console.warn('unknown cell data', cellInfo);
    }

    drawMultiLineText(
      excelRender,
      sheet,
      ctx,
      dataProvider,
      fontStyle,
      lines,
      x + padding,
      y + padding,
      displayWidth,
      height - padding * 2,
      padding,
      horizontal,
      vertical,
      cellInfo.text,
      cellInfo.row,
      linkPositionCache
    );
  } else {
    // [comment removed]
    if (cellInfo.text) {
      drawSingleLineText(
        ctx,
        fontStyle,
        cellInfo.text,
        fontStyle.color,
        x + padding,
        y + padding,
        displayWidth,
        height - padding * 2,
        indent * indentSize,
        horizontal,
        vertical,
        linkPositionCache
      );
    } else if (
      typeof cellInfo.cellData === 'object' &&
      'richText' in cellInfo.cellData
    ) {
      drawSingleLineRichText(
        excelRender,
        sheet,
        ctx,
        dataProvider,
        fontStyle,
        cellInfo.cellData.richText as IRElt[],
        x + padding,
        y + padding,
        displayWidth,
        height - padding * 2,
        horizontal,
        vertical,
        cellInfo.row
      );
    }
  }

  if (needClip) {
    ctx.restore();
  }
}
