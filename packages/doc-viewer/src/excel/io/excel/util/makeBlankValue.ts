import {CellData} from '../../../types/worksheet/CellData';

import {RangeRef} from '../../../types/RangeRef';

/**
 */
export function makeBlankValue(cellData: CellData[][], range: RangeRef) {
  for (let i = range.startRow; i <= range.endRow; i++) {
    let rowData = cellData[i];
    if (!rowData) {
      rowData = [];
      cellData[i] = rowData;
    }
    for (let j = range.startCol; j <= range.endCol; j++) {
      if (rowData[j] === undefined) {
        rowData[j] = {
          type: 'blank'
        };
      }
    }
  }
}
