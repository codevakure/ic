import {MAX_COL} from '../Consts';
import {dragState} from './handleMousedown';
/**
 */

export function handleDragRowHeader(offsetX: number, offsetY: number) {
  // [comment removed]
  if (!dragState.selection) {
    console.warn('No selection');
    return;
  }
  // [comment removed]
  const hitTestResult = dragState.workbook
    ?.getActiveSheet()
    .hitTest(offsetX, offsetY);

  const row = dragState.selection.activeCell.startRow;

  // [comment removed]
  const firstCellRange = dragState.selection.cellRanges[0];

  if (hitTestResult) {
    // [comment removed]
    if (hitTestResult.region !== dragState.region) {
      console.warn('Cross-region drag not supported');
      return;
    }
    // [comment removed]
    if (hitTestResult.startRow !== row) {
      const startRow = Math.min(row, hitTestResult.startRow);
      const endRow = Math.max(row, hitTestResult.startRow);
      if (
        startRow === firstCellRange.startRow &&
        endRow === firstCellRange.endRow
      ) {
        return;
      }
      firstCellRange.startRow = startRow;
      firstCellRange.endRow = endRow;
      firstCellRange.startCol = 0;
      firstCellRange.endCol = MAX_COL;
      dragState.workbook?.uiEvent.emit('CHANGE_SELECTION', dragState.selection);
    } else {
      // [comment removed]
      if (firstCellRange.startRow !== firstCellRange.endRow) {
        firstCellRange.endRow = firstCellRange.startRow;
        firstCellRange.startCol = 0;
        firstCellRange.endCol = MAX_COL;
        dragState.workbook?.uiEvent.emit(
          'CHANGE_SELECTION',
          dragState.selection
        );
      }
    }
  }
}
