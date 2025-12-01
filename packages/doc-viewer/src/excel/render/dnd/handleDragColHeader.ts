import {MAX_ROW} from '../Consts';
import {dragState} from './handleMousedown';
/**
 */
export function handleDragColHeader(offsetX: number, offsetY: number) {
  if (!dragState.selection) {
    console.warn('No selection');
    return;
  }

  // [comment removed]
  const hitTestResult = dragState.workbook
    ?.getActiveSheet()
    .hitTest(offsetX, offsetY);

  const col = dragState.selection.activeCell.startCol;

  // [comment removed]
  const firstCellRange = dragState.selection.cellRanges[0];

  if (hitTestResult) {
    // [comment removed]
    if (hitTestResult.region !== dragState.region) {
      console.warn('Cross-region drag not supported');
      return;
    }
    // [comment removed]
    if (hitTestResult.startCol !== col) {
      const startCol = Math.min(col, hitTestResult.startCol);
      const endCol = Math.max(col, hitTestResult.startCol);
      if (
        startCol === firstCellRange.startCol &&
        endCol === firstCellRange.endCol
      ) {
        return;
      }
      firstCellRange.startCol = startCol;
      firstCellRange.endCol = endCol;
      firstCellRange.startRow = 0;
      firstCellRange.endRow = MAX_ROW;
      dragState.workbook?.uiEvent.emit('CHANGE_SELECTION', dragState.selection);
    } else {
      // [comment removed]
      if (firstCellRange.startCol !== firstCellRange.endCol) {
        firstCellRange.startCol = col;
        firstCellRange.endCol = col;
        firstCellRange.startRow = 0;
        firstCellRange.endRow = MAX_ROW;
        dragState.workbook?.uiEvent.emit(
          'CHANGE_SELECTION',
          dragState.selection
        );
      }
    }
  }
}
