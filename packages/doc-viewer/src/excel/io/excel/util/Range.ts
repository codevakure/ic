/**
 */

import {MAX_ROW} from '../../../render/Consts';
import {ViewRange} from '../../../sheet/ViewRange';
import {RangeRef} from '../../../types/RangeRef';
import {columnNameToNumber, decodeAddress} from './decodeAddress';
import {numberToLetters} from './numberToLetters';

/**
 */
export function parseRange(range: string): RangeRef {
  if (range.indexOf(':') !== -1) {
    const parts = range.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid range format');
    }
    const [start, end] = parts;
    if (start.match(/^[A-Z]{1,3}$/) && end.match(/^[A-Z]{1,3}$/)) {
      const startCol = columnNameToNumber(start);
      const endCol = columnNameToNumber(end);
      return {
        startRow: 0,
        startCol,
        endRow: MAX_ROW,
        endCol
      };
    }
    const startRange = decodeAddress(start);
    const endRange = decodeAddress(end);
    return {
      startRow: startRange.row,
      startCol: startRange.col,
      endRow: endRange.row,
      endCol: endRange.col
    };
  } else {
    if (range.match(/^[A-Z]{1,3}$/)) {
      const col = columnNameToNumber(range);
      return {
        startRow: 0,
        startCol: col,
        endRow: MAX_ROW,
        endCol: col
      };
    }

    const startRange = decodeAddress(range);
    return {
      startRow: startRange.row,
      startCol: startRange.col,
      endRow: startRange.row,
      endCol: startRange.col
    };
  }
}

/**
 */
export function rangeRefToString(rangeRef: RangeRef) {
  return (
    numberToLetters(rangeRef.startCol) +
    (rangeRef.startRow + 1) +
    ':' +
    numberToLetters(rangeRef.endCol) +
    (rangeRef.endRow + 1)
  );
}

/**
 * @param range1
 * @param range2
 * @returns
 */
export function mergeRange(range1: RangeRef, range2: RangeRef) {
  return {
    startRow: Math.min(range1.startRow, range2.startRow),
    startCol: Math.min(range1.startCol, range2.startCol),
    endRow: Math.max(range1.endRow, range2.endRow),
    endCol: Math.max(range1.endCol, range2.endCol)
  };
}

/**
 */
export function inRange(range: RangeRef, otherRange: RangeRef) {
  return (
    range.startRow <= otherRange.startRow &&
    range.startCol <= otherRange.startCol &&
    range.endRow >= otherRange.endRow &&
    range.endCol >= otherRange.endCol
  );
}

/**
 * @param range1
 * @param range2
 */
export function rangeEqual(range1: RangeRef, range2: RangeRef) {
  return (
    range1.startRow === range2.startRow &&
    range1.startCol === range2.startCol &&
    range1.endRow === range2.endRow &&
    range1.endCol === range2.endCol
  );
}

/**
 */
export function getIntersectRange(
  range1: RangeRef,
  range2: RangeRef
): RangeRef | null {
  if (!rangeIntersect(range1, range2)) {
    return null;
  }
  return {
    startRow: Math.max(range1.startRow, range2.startRow),
    startCol: Math.max(range1.startCol, range2.startCol),
    endRow: Math.min(range1.endRow, range2.endRow),
    endCol: Math.min(range1.endCol, range2.endCol)
  };
}

/**
 */
export function getIntersectRanges(ranges: RangeRef[]): RangeRef | null {
  if (ranges.length === 0) {
    return null;
  }
  let result: RangeRef | null = ranges[0];
  for (let i = 1; i < ranges.length; i++) {
    const range = ranges[i];
    result = getIntersectRange(result, range);
    if (!result) {
      return null;
    }
  }
  return result;
}

/**
 */
export function rangeIntersect(range1: RangeRef, range2: RangeRef) {
  return (
    range1.startRow <= range2.endRow &&
    range1.endRow >= range2.startRow &&
    range1.startCol <= range2.endCol &&
    range1.endCol >= range2.startCol
  );
}

/**
 * @param range
 * @param mergeCells
 * @returns
 */
export function isMergeCell(range: RangeRef, mergeCells: RangeRef[]) {
  return mergeCells.some(mergeCell => rangeEqual(mergeCell, range));
}

/**
 * @param range
 */
export function isSingleCell(range: RangeRef) {
  return range.startRow === range.endRow && range.startCol === range.endCol;
}

/**
 */
export function isCellInRange(range: RangeRef, row: number, col: number) {
  return (
    range.startRow <= row &&
    range.startCol <= col &&
    range.endRow >= row &&
    range.endCol >= col
  );
}

/**
 */
export function viewRangeToRangeRef(viewRange: ViewRange) {
  const rows = viewRange.rows;
  const cols = viewRange.cols;

  return {
    startRow: rows[0],
    startCol: cols[0],
    endRow: rows[rows.length - 1],
    endCol: cols[cols.length - 1]
  };
}

/**
 */
