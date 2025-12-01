/**
 */

export type Size = {
  size: number;
  offset: number;
};

/**
 */
export type Region =
  | 'normal'
  | 'left-frozen'
  | 'top-frozen'
  | 'top-left-frozen';

/**
 */

export type ViewRange = {
  /**
   */
  region: Region;
  /**
   */
  rows: number[];
  /**
   */
  startRowOffset: number;

  /**
   */
  rowSizes: Size[];

  /**
   */
  height: number;

  /**
   */
  cols: number[];
  /**
   */
  startColOffset: number;

  /**
   */
  colSizes: Size[];

  /**
   */
  width: number;
};
