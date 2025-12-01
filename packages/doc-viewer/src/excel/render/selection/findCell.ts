import {Region, ViewRange} from '../../sheet/ViewRange';
import {RangeRef} from '../../types/RangeRef';
import {cellToMergeCell} from '../cell/cellToMergeCell';
import {findInViewRange} from './findInViewRange';
import {HitTestResult} from './hitTest';

/**
 */
export function findCell(
  region: Region,
  offsetX: number,
  offsetY: number,
  gridLineHitRange: number,
  viewRange: ViewRange,
  mergeCells: RangeRef[]
): HitTestResult {
  // [comment removed]
  const {row, col, x, y, width, height} = findInViewRange(
    offsetX,
    offsetY,
    gridLineHitRange,
    viewRange
  );
  const mergeCell = cellToMergeCell(row, col, mergeCells);
  return {
    type: 'cell',
    region,
    ...mergeCell,
    realCol: col,
    realRow: row,
    x,
    y,
    width,
    height
  };
}
