import {Workbook} from '../../Workbook';
import {RangeRef} from '../../types/RangeRef';
import {Canvas} from '../Canvas';
import {SheetSelection} from './SheetSelection';
import {drawSelectionHeaderHighlight} from './drawSelectionHeaderHighlight';
import {getCellPosition, getCellPositionWithMerge} from './getCellPosition';
import {getRangePosition} from './getRangePosition';

/**
 * @param workbook
 * @param canvas
 * @param selection
 * @param range
 * @returns
 */
export function drawCellSelection(
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

  // [comment removed]
  if (width === 0 || height === 0) {
    return;
  }
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

  const rightBottomStrokeSize = renderOptions.selectionSquareSize;
  // [comment removed]
  canvas.drawStrokeRect(
    x + width - rightBottomStrokeSize,
    y + height - rightBottomStrokeSize,
    rightBottomStrokeSize * 2,
    rightBottomStrokeSize * 2,
    '#FFFFFF',
    1
  );
  const rightBottomRectSize = rightBottomStrokeSize - 1;

  const padding = 1;
  // [comment removed]
  canvas.drawAlphaRectPadding(
    x,
    y,
    width,
    height,
    padding,
    renderOptions.selectionBackgroundColor,
    renderOptions.selectionBackgroundOpacity
  );

  // [comment removed]
  // [comment removed]
  const activeCell = selection.activeCell;
  let paddingX = 0;
  let paddingY = 0;
  // [comment removed]
  if (
    activeCell.startCol === range.startCol &&
    activeCell.startRow === range.startRow
  ) {
    paddingX = padding;
    paddingY = padding;
  } else if (
    activeCell.endCol === range.endCol &&
    activeCell.endRow === range.endRow
  ) {
    // [comment removed]
    paddingX = padding;
    paddingY = padding;
    // [comment removed]
    if (range.startCol === range.endCol) {
      paddingX = padding;
    }
    // [comment removed]
    if (range.startRow === range.endRow) {
      paddingY = padding;
    }
  } else if (
    activeCell.startCol === range.startCol &&
    activeCell.endRow === range.endRow
  ) {
    // [comment removed]
    paddingX = padding;
    paddingY = -padding;
  } else if (
    // [comment removed]
    activeCell.endCol === range.endCol &&
    activeCell.startRow === range.startRow
  ) {
    paddingX = padding;
    paddingY = padding;
  }

  const activeCellPosition = getCellPositionWithMerge(
    workbook.getActiveSheet(),
    selection.region,
    activeCell.startCol,
    activeCell.startRow
  );
  if (activeCellPosition) {
    canvas.clearRect(
      activeCellPosition.x + paddingX,
      activeCellPosition.y + paddingY,
      activeCellPosition.width - 2 * padding,
      activeCellPosition.height - 2 * padding
    );
  }

  // [comment removed]
  canvas.drawRect(
    x + width - rightBottomRectSize,
    y + height - rightBottomRectSize,
    rightBottomRectSize * 2,
    rightBottomRectSize * 2,
    renderOptions.selectionBorderColor
  );

  // [comment removed]
  drawSelectionHeaderHighlight(workbook, canvas, x, y, width, height);
}
