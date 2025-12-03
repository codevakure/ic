import {CT_CustomFilters} from '../../../openxml/ExcelTypes';
import {CellValueNum} from './CellValueNum';
import {evalCustomFilter} from './evalCustomFilter';

/**
 */
export function customFilter(
  values: CellValueNum[],
  customFilters?: CT_CustomFilters
) {
  if (!customFilters) {
    return new Set<number>();
  }
  const hiddenRows = new Set<number>();
  const showRows = new Set<number>();
  const and = customFilters.and;
  const filters = customFilters.customFilter || [];

  for (const cellValue of values) {
    for (const filter of filters) {
      const operator = filter.operator;
      const val = filter.val;
      if (val === undefined) {
        continue;
      }

      const evalResult = evalCustomFilter(operator, val, cellValue);

      // [comment removed]
      if (and) {
        if (!evalResult) {
          hiddenRows.add(cellValue.row);
          break;
        }
      } else {
        // [comment removed]
        hiddenRows.add(cellValue.row);
        if (evalResult) {
          showRows.add(cellValue.row);
        }
      }
    }
  }

  if (!and) {
    for (const row of showRows) {
      hiddenRows.delete(row);
    }
  }

  return hiddenRows;
}
