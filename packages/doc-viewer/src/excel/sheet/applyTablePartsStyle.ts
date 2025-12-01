import {isCellInRange, parseRange} from '../io/excel/util/Range';
import {CellInfo} from '../types/CellInfo';
import {Sheet} from './Sheet';
import {applyTableStyle} from './table/applyTableStyle';

/**
 */
export function applyTablePartsStyle(sheet: Sheet, cellInfo: CellInfo) {
  const row = cellInfo.row;
  const col = cellInfo.col;
  for (const tablePart of sheet.getTableParts()) {
    if (!tablePart.ref) {
      console.warn('Table missing ref field', tablePart);
      continue;
    }
    const ref = parseRange(tablePart.ref);

    if (isCellInRange(ref, row, col)) {
      applyTableStyle(cellInfo, tablePart, ref, sheet, row, col);
    }
  }
}
