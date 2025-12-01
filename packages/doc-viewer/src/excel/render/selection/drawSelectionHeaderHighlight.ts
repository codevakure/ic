import {Workbook} from '../../Workbook';
import {Canvas} from '../Canvas';

/**
 */
export function drawSelectionHeaderHighlight(
  workbook: Workbook,
  canvas: Canvas,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const {rowHeaderWidth, colHeaderHeight} = workbook
    .getActiveSheet()
    .getRowColSize();
  const renderOptions = workbook.renderOptions;
  if (rowHeaderWidth > 0 && colHeaderHeight > 0) {
    // [comment removed]
    canvas.drawAlphaRect(
      x,
      0,
      width,
      colHeaderHeight,
      renderOptions.selectionBackgroundColor,
      renderOptions.selectionBackgroundOpacity
    );
    // [comment removed]
    canvas.drawAlphaRect(
      0,
      y,
      rowHeaderWidth,
      height,
      renderOptions.selectionBackgroundColor,
      renderOptions.selectionBackgroundOpacity
    );
  }
}
