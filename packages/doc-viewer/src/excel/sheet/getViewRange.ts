import {Size, ViewRange} from './ViewRange';

export interface RangeInfo {
  /**
   */
  indexes: number[];

  /**
   */
  startOffset: number;

  /**
   */
  sizes: Size[];

  /**
   */
  length: number;
}

/**
 */
export interface IndexInfo {
  offset: number;
  size: number;
}

/**
 */
export interface HiddenRange {
  min: number;
  max: number;
}

/**
 * @param rangeCache
 * @param target
 * @returns
 */
export function findStartInCache(rangeCache: IndexInfo[], target: number) {
  let start = 0,
    end = rangeCache.length - 1;
  let found = -1;

  while (start < end) {
    let mid = Math.floor((start + end) / 2);

    const indexInfo = rangeCache[mid];
    // [comment removed]
    if (!indexInfo) {
      console.error('findStartInCache indexInfo is undefined');
      break;
    }

    const indexRange = indexInfo.offset + indexInfo.size;
    if (indexRange === target) {
      found = mid;
      break;
    } else if (indexRange < target) {
      start = mid + 1;
    } else {
      end = mid;
    }
  }
  if (found !== -1) {
    return found;
  } else {
    return start;
  }
}

/**
 * @returns
 */
export function getRange(
  offset: number,
  shift: number,
  totalLength: number,
  getHeight: (index: number) => number,
  hiddenRange: HiddenRange[] = [],
  rangeCache: IndexInfo[] = []
): RangeInfo {
  // [comment removed]
  let foundStart = false;
  let foundEnd = false;
  let index = 0;
  let startOffset = 0;
  let currentOffset = 0;
  // [comment removed]
  offset = offset || 0;
  totalLength = totalLength || 0;
  const indexes: number[] = [];
  const sizes: Size[] = [];
  const MAX_LOOP = 10000;
  let loop = 0;
  if (rangeCache.length) {
    const lastRangeCache = rangeCache[rangeCache.length - 1];
    if (lastRangeCache.offset < offset) {
      index = rangeCache.length;
      currentOffset = lastRangeCache.offset;
    } else {
      const foundIndex = findStartInCache(rangeCache, offset);
      // [comment removed]
      if (foundIndex !== -1) {
        index = foundIndex;
        currentOffset = rangeCache[index].offset;
      }
    }
  }

  while (!(foundStart && foundEnd)) {
    // [comment removed]
    for (const range of hiddenRange) {
      if (index >= range.min && index <= range.max) {
        index = range.max + 1;
        // [comment removed]
        if (range.max > rangeCache.length - 1) {
          for (let i = range.min; i <= range.max; i++) {
            rangeCache[i] = {
              offset: currentOffset,
              size: 0
            };
          }
        }
        continue;
      }
    }

    const cellLength = getHeight(index) || 0;
    rangeCache[index] = {
      offset: currentOffset,
      size: cellLength
    };

    // [comment removed]
    if (currentOffset + cellLength >= offset && !foundStart) {
      startOffset = currentOffset - offset;
      foundStart = true;
      indexes.push(index);
      sizes.push({
        size: cellLength,
        offset: currentOffset - offset + shift
      });
      currentOffset += cellLength;
      index = index + 1;
      continue;
    }

    // [comment removed]
    if (currentOffset + cellLength >= offset + totalLength && !foundEnd) {
      foundEnd = true;
      indexes.push(index);
      sizes.push({
        size: cellLength,
        offset: currentOffset - offset + shift
      });
    }

    // [comment removed]
    if (foundStart && !foundEnd) {
      indexes.push(index);
      sizes.push({
        size: cellLength,
        offset: currentOffset - offset + shift
      });
    }

    currentOffset += cellLength;

    // [comment removed]
    if (loop++ > MAX_LOOP) {
      console.error('getRange loop too many times');
      break;
    }
    index = index + 1;
  }

  return {
    indexes,
    sizes,
    startOffset,
    length: totalLength + shift
  };
}

/**
 *
 *
 */
export function getViewRange(
  scrollLeft: number,
  scrollTop: number,
  leftShift: number,
  topShift: number,
  height: number,
  width: number,
  getRowHeight: (index: number) => number,
  rowPositionCache: IndexInfo[] = [],
  getColWidth: (index: number) => number,
  colPositionCache: IndexInfo[] = [],
  colHiddenRange: HiddenRange[] = []
): ViewRange {
  const {
    indexes: rows,
    startOffset: startRowOffset,
    sizes: rowSizes
  } = getRange(scrollTop, topShift, height, getRowHeight, [], rowPositionCache);

  const {
    indexes: cols,
    startOffset: startColOffset,
    sizes: colSizes
  } = getRange(
    scrollLeft,
    leftShift,
    width,
    getColWidth,
    colHiddenRange,
    colPositionCache
  );

  return {
    region: 'normal',
    rows,
    rowSizes,
    height,
    startRowOffset,
    cols,
    colSizes,
    width,
    startColOffset
  };
}
