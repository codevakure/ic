import {ViewRange} from '../../sheet/ViewRange';
import {binarySearchSize} from './binarySearchSize';
import {HitTestResult} from './hitTest';

/**
 */
export function findInViewRangeY(
  offsetY: number,
  viewRange: ViewRange,
  gridLineHitRange: number,
  // [comment removed]
  isHeader: boolean = false
) {
  let y = 0;
  let height = 0;
  let rowIndex = binarySearchSize(viewRange.rowSizes, offsetY);
  // [comment removed]
  let type: HitTestResult['type'] = 'cell';
  if (isHeader) {
    type = 'row-header';
  }

  let row = -1;
  if (rowIndex !== -1) {
    y = viewRange.rowSizes[rowIndex].offset;
    height = viewRange.rowSizes[rowIndex].size;
    row = viewRange.rows[rowIndex];
    if (isHeader) {
      if (y + height - offsetY < gridLineHitRange) {
        type = 'row-grid';
      }
      // [comment removed]
      if (offsetY - y < gridLineHitRange) {
        type = 'row-grid';
        if (rowIndex > 0) {
          y = viewRange.rowSizes[rowIndex - 1].offset;
          height = viewRange.rowSizes[rowIndex - 1].size;
          row = viewRange.rows[rowIndex - 1];
        }
      }
    }
  }

  return {row, y, height, type};
}
