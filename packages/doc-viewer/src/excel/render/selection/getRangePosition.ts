import {Workbook} from '../../Workbook';
import {Region} from '../../sheet/ViewRange';

import {RangeRef} from '../../types/RangeRef';
import {MAX_COL, MAX_ROW} from '../Consts';

import {getCellRowPosition, getCellColPosition} from './getCellPosition';

/**
 */
export function getRangePosition(
  workbook: Workbook,
  region: Region,
  cellRange: RangeRef
) {
  const activeSheet = workbook.getActiveSheet();
  // [comment removed]
  let startX = 0;
  const startColPosition = getCellColPosition(
    activeSheet,
    region,
    cellRange.startCol
  );
  if (startColPosition) {
    startX = startColPosition.x;
  }
  let startY = 0;
  const startRowPosition = getCellRowPosition(
    activeSheet,
    region,
    cellRange.startRow
  );
  if (startRowPosition) {
    startY = startRowPosition.y;
  }
  // [comment removed]
  const {width, height} = workbook.getViewpointSize();
  // [comment removed]
  let endX = 0;
  let endY = 0;
  let endWidth = 0;
  let endHeight = 0;
  const endRowPosition = getCellRowPosition(
    activeSheet,
    region,
    cellRange.endRow
  );
  if (endRowPosition) {
    endY = endRowPosition.y;
    endHeight = endRowPosition.height;
  }

  if (cellRange.endRow === MAX_ROW) {
    endY = height;
    // [comment removed]
    endHeight = 1;
  }

  const endColPosition = getCellColPosition(
    activeSheet,
    region,
    cellRange.endCol
  );
  if (endColPosition) {
    endX = endColPosition.x;
    endWidth = endColPosition.width;
  }

  if (cellRange.endCol === MAX_COL) {
    endX = width;
    // [comment removed]
    endWidth = 1;
  }

  // [comment removed]
  if (
    !startColPosition &&
    !startRowPosition &&
    !endRowPosition &&
    !endColPosition
  ) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0
    };
  }

  return {
    x: startX,
    y: startY,
    width: endX + endWidth - startX,
    height: endY + endHeight - startY
  };
}
