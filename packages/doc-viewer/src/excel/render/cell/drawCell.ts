import {Sheet} from '../../sheet/Sheet';
import {CellInfo} from '../../types/CellInfo';
import {IDataProvider} from '../../types/IDataProvider';
import {Canvas} from '../Canvas';
import type {ExcelRender} from '../ExcelRender';
import {LinkPosition} from './LinkPosition';
import {drawCellBackground} from './drawCellBackground';
import {drawCellBorder} from './drawCellBorder';
import {drawCellDataBar} from './drawDataBar';
import {drawIconSet} from './drawIconSet';
import {drawTextInCell} from './drawTextInCell';

/**
 * @param ctx
 * @param dataProvider
 * @param cellInfo
 * @param x
 * @param y
 * @param width
 * @param height
 * @param padding
 * @param needClear
 */
export function drawCell(
  excelRender: ExcelRender,
  sheet: Sheet,
  canvas: Canvas,
  dataProvider: IDataProvider,
  cellInfo: CellInfo,
  x: number,
  y: number,
  width: number,
  height: number,
  indentSize: number,
  padding: number,
  needClear = false,
  linkPositionCache: LinkPosition[] = []
) {
  const ctx = canvas.ctx;
  if (needClear) {
    // [comment removed]
    ctx.clearRect(x + 1, y + 1, width - 2, height - 2);
  }

  drawCellBackground(ctx, dataProvider, cellInfo, x, y, width, height);

  let drawText = true;
  if (cellInfo.dataBarDisplay) {
    // [comment removed]
    drawCellDataBar(canvas, cellInfo.dataBarDisplay, x, y, width, height);
    drawText = cellInfo.dataBarDisplay.showValue;
  }

  if (cellInfo.icon) {
    drawIconSet(canvas, cellInfo.icon, x, y, width, height);
  }

  if (drawText) {
    drawTextInCell(
      excelRender,
      sheet,
      ctx,
      dataProvider,
      cellInfo,
      x,
      y,
      width,
      height,
      indentSize,
      padding,
      linkPositionCache
    );
  }

  // [comment removed]
  drawCellBorder(ctx, dataProvider, cellInfo, x, y, width, height);
}
