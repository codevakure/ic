/**
 */

import type {Sheet} from './Sheet';

export class SheetBounding {
  sheet: Sheet;
  constructor(sheet: Sheet) {
    this.sheet = sheet;
  }

  /**
   */
  contentBoundingRect: {
    width: number;
    height: number;
  };

  /**
   */
  getContentBoundingRect() {
    return this.contentBoundingRect;
  }
}
