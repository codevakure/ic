import {Workbook} from '../../Workbook';
import {Canvas} from '../Canvas';
import {SheetSelection} from './SheetSelection';
import {drawSelectionHeaderHighlight} from './drawSelectionHeaderHighlight';

/**
 */
export function drawAllSelection(
  workbook: Workbook,
  canvas: Canvas,
  selection: SheetSelection
) {
  const x = 0;
  const y = 0;
  const {width, height} = workbook.getViewpointSize();
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
