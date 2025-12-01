import {IWorksheet} from '../../types/IWorksheet';
import {parseRange} from './util/Range';
import {makeBlankValue} from './util/makeBlankValue';

/**
 */
export function initValueForTable(worksheet: IWorksheet) {
  const tableParts = worksheet.tableParts || [];

  for (const tablePart of tableParts) {
    if (!tablePart.ref) {
      console.warn('Table missing ref field', tablePart);
      continue;
    }
    const ref = parseRange(tablePart.ref);
    makeBlankValue(worksheet.cellData, ref);
  }
}
