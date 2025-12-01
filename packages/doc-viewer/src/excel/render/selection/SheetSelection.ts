import {Region} from '../../sheet/ViewRange';
import {RangeRef} from '../../types/RangeRef';
import {HitTestResult} from './hitTest';

/**
 */
export type SheetSelection = {
  selectType: HitTestResult['type'];

  /**
   */
  region: Region;

  /**
   */
  user: string;

  /**
   */
  sheetIndex: number;

  /**
   */
  activeCell: RangeRef;

  /**
   */
  cellRanges: RangeRef[];
};
