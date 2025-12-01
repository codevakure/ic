import {IWorksheet} from '../../types/IWorksheet';
import {parseRange} from './util/Range';
import {makeBlankValue} from './util/makeBlankValue';

/**
 */
export function initValueForContainsBlanks(worksheet: IWorksheet) {
  for (const formatting of worksheet.conditionalFormatting) {
    const cfRules = formatting.cfRule || [];
    for (const cfRule of cfRules) {
      if (cfRule.type === 'containsBlanks') {
        const sqref = formatting.sqref;
        if (!sqref) {
          continue;
        }
        const ranges = sqref.split(' ').map(parseRange);
        for (const range of ranges) {
          makeBlankValue(worksheet.cellData, range);
        }
      }
    }
  }
}
