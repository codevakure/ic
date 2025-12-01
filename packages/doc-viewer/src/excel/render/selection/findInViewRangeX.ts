import {ViewRange} from '../../sheet/ViewRange';
import {binarySearchSize} from './binarySearchSize';
import {HitTestResult} from './hitTest';

/**
 */
export function findInViewRangeX(
  offsetX: number,
  viewRange: ViewRange,
  gridLineHitRange: number,
  // [comment removed]
  isHeader: boolean = false
) {
  let x = 0;
  let width = 0;
  let colIndex = binarySearchSize(viewRange.colSizes, offsetX);
  let col = -1;
  // [comment removed]
  let type: HitTestResult['type'] = 'cell';
  if (isHeader) {
    type = 'col-header';
  }

  if (colIndex !== -1) {
    x = viewRange.colSizes[colIndex].offset;
    width = viewRange.colSizes[colIndex].size;
    col = viewRange.cols[colIndex];
    if (isHeader) {
      // [comment removed]
      if (x + width - offsetX < gridLineHitRange) {
        type = 'col-grid';
      }
      // [comment removed]
      if (offsetX - x < gridLineHitRange) {
        type = 'col-grid';
        if (colIndex > 0) {
          x = viewRange.colSizes[colIndex - 1].offset;
          width = viewRange.colSizes[colIndex - 1].size;
          col = viewRange.cols[colIndex - 1];
        }
      }
    }
  }

  return {col, x, width, type};
}
