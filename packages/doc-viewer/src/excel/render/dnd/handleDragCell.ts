import {objectEqual} from '../../../util/objectEqual';
import {mergeRange} from '../../io/excel/util/Range';
import {RangeRef} from '../../types/RangeRef';
import {cellToMergeCell} from '../cell/cellToMergeCell';
import {dragState} from './handleMousedown';

/**
 */
function mergeWithNewCell(
  range: RangeRef,
  mergeCells: RangeRef[],
  row: number,
  col: number
) {
  const mergeCell = cellToMergeCell(row, col, mergeCells);
  return mergeRange(range, mergeCell);
}

/**
 */
function mergeWithAllBorder(range: RangeRef, mergeCells: RangeRef[]): RangeRef {
  let newRange = {...range};
  // [comment removed]
  for (let i = newRange.startCol; i <= newRange.endCol; i++) {
    newRange = mergeWithNewCell(newRange, mergeCells, newRange.startRow, i);
  }
  // [comment removed]
  for (let i = newRange.startCol; i <= newRange.endCol; i++) {
    newRange = mergeWithNewCell(newRange, mergeCells, newRange.endRow, i);
  }
  // [comment removed]
  for (let i = newRange.startRow; i <= newRange.endRow; i++) {
    newRange = mergeWithNewCell(newRange, mergeCells, i, newRange.startCol);
  }
  // [comment removed]
  for (let i = newRange.startRow; i <= newRange.endRow; i++) {
    newRange = mergeWithNewCell(newRange, mergeCells, i, newRange.endCol);
  }

  // [comment removed]
  if (!objectEqual(newRange, range)) {
    return mergeWithAllBorder(newRange, mergeCells);
  }
  return newRange;
}

/**
 */
export function handleDragCell(offsetX: number, offsetY: number) {
  // [comment removed]
  if (!dragState.selection) {
    console.warn('No selection');
    return;
  }

  if (dragState.selection.cellRanges.length === 0) {
    console.warn('No cell ranges');
    return;
  }

  // [comment removed]
  const firstCellRange = dragState.selection.cellRanges[0];

  // [comment removed]
  const hitTestResult = dragState.workbook
    ?.getActiveSheet()
    .hitTest(offsetX, offsetY);

  // [comment removed]
  if (hitTestResult && hitTestResult.type === dragState.dragType) {
    const mergeCells =
      dragState.workbook?.getActiveSheet().getMergeCells() || [];

    // [comment removed]
    let newRange = mergeRange(dragState.selection.activeCell, hitTestResult);

    if (mergeCells.length) {
      // [comment removed]
      newRange = mergeWithAllBorder(newRange, mergeCells);
    }

    if (!objectEqual(newRange, firstCellRange)) {
      Object.assign(firstCellRange, newRange);
      dragState.workbook?.uiEvent.emit('CHANGE_SELECTION', dragState.selection);
    }
  }
}
