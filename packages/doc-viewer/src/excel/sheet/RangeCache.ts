/**
 */

import {rangeIntersect} from '../io/excel/util/Range';
import {RangeRef} from '../types/RangeRef';

/**
 */
export function rangeCacheKey(range: RangeRef) {
  return `${range.startRow}-${range.startCol}-${range.endRow}-${range.endCol}`;
}

export function rangeCacheKeyToRange(key: string) {
  const [startRow, startCol, endRow, endCol] = key.split('-');
  return {
    startRow: parseInt(startRow, 10),
    startCol: parseInt(startCol, 10),
    endRow: parseInt(endRow, 10),
    endCol: parseInt(endCol, 10)
  };
}

export class RangeCache {
  /**
   */
  private cache: Map<string, Map<string, any>> = new Map();

  /**
   */
  public set(ranges: RangeRef[], key: string, value: any) {
    const cacheKey = ranges.map(rangeCacheKey).join(' ');
    if (!this.cache.has(cacheKey)) {
      this.cache.set(cacheKey, new Map());
    }
    this.cache.get(cacheKey)!.set(key, value);
  }

  /**
   */
  public get(ranges: RangeRef[], key: string) {
    const cacheKey = ranges.map(rangeCacheKey).join(' ');
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!.get(key);
    }
    return null;
  }

  /**
   */
  public clear(ranges: RangeRef[]) {
    for (const range of ranges) {
      for (const rangeKeys of this.cache.keys()) {
        const cacheRanges = rangeKeys.split(' ').map(rangeCacheKeyToRange);
        for (const cacheRange of cacheRanges) {
          if (rangeIntersect(range, cacheRange)) {
            this.cache.delete(rangeKeys);
            break;
          }
        }
      }
    }
  }
}
