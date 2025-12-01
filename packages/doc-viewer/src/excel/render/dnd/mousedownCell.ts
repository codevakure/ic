import type {Workbook} from '../../Workbook';
import {RangeRef} from '../../types/RangeRef';
import {SheetSelection} from '../selection/SheetSelection';
import {HitTestResult} from '../selection/hitTest';

/**
 * @param workbook
 * @param hitTestResult
 */
export function mousedownCell(
  workbook: Workbook,
  hitTestResult: HitTestResult
) {
  const activeCell: RangeRef = {
    startRow: hitTestResult.startRow,
    startCol: hitTestResult.startCol,
    endRow: hitTestResult.endRow,
    endCol: hitTestResult.endCol
  };

  const newSelection: SheetSelection = {
    // [comment removed]
    user: '',
    region: hitTestResult.region,
    selectType: hitTestResult.type,
    activeCell,
    sheetIndex: workbook.getActiveSheet().getIndex(),
    // [comment removed]
    cellRanges: [
      {
        ...activeCell
      }
    ]
  };

  return newSelection;
}
