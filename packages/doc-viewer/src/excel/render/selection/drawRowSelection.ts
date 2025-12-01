/**
 * @param workbook
 * @param canvas
 * @param selection
 * @param range
 */

import {Workbook} from '../../Workbook';
import {RangeRef} from '../../types/RangeRef';
import {Canvas} from '../Canvas';
import {SheetSelection} from './SheetSelection';
import {drawSelectionHeaderHighlight} from './drawSelectionHeaderHighlight';
import {getRangePosition} from './getRangePosition';

export function drawRowSelection(
  workbook: Workbook,
  canvas: Canvas,
  selection: SheetSelection,
  range: RangeRef
) {
  let {x, y, width, height} = getRangePosition(
    workbook,
    selection.region,
    range
  );

  
  const renderOptions = workbook.renderOptions;

  // [comment removed]
  canvas.drawStrokeRect(
    x,
    y,
    width,
    height,
    renderOptions.selectionBorderColor,
    2
  );

  // [comment removed]
  drawSelectionHeaderHighlight(workbook, canvas, x, y, width, height);
}
