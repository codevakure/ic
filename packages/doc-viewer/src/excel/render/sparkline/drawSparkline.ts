/**
 */

import {
  parseRange,
  rangeIntersect,
  viewRangeToRangeRef
} from '../../io/excel/util/Range';
import {Sheet} from '../../sheet/Sheet';

import {SheetCanvas} from '../SheetCanvas';
import {renderSparkline} from './renderSparkline';
import {getRangePosition} from '../selection/getRangePosition';
import {ViewRange} from '../../sheet/ViewRange';

export function drawSparkline(
  currentSheet: Sheet,
  viewRange: ViewRange,
  canvas: SheetCanvas
) {
  const workbook = currentSheet.getWorkbook();

  const viewRangeRef = viewRangeToRangeRef(viewRange);

  const sparklineGroups = currentSheet.getSparklineGroups();

  for (const sparklineGroup of sparklineGroups) {
    for (const sparkline of sparklineGroup['x14:sparklines']?.[
      'x14:sparkline'
    ] || []) {
      const f = sparkline['xm:f'];
      const sqref = sparkline['xm:sqref'];
      if (!f || !sqref) {
        console.warn('Sparkline missing required xm:f and xm:sqref fields', sparkline);
        continue;
      }

      const sqrefCellRange = parseRange(sqref);

      if (rangeIntersect(viewRangeRef, sqrefCellRange)) {
        if (f.includes('!')) {
          const cellDisplayData = getRangePosition(
            workbook,
            viewRange.region,
            sqrefCellRange
          );

          if (!cellDisplayData) {
            console.warn('Cell not found', sqref);
            continue;
          }

          const [sheetName, rangeStr] = f.split('!');
          // [comment removed]
          const dataRange = parseRange(rangeStr);
          const targetSheet = workbook.getSheetByName(sheetName);
          if (targetSheet) {
            const displayHidden = sparklineGroup.displayHidden;
            const dataInRange = targetSheet.getCellValueByRange(
              dataRange,
              displayHidden
            );
            const data = dataInRange.map(val => val.value + '');
            const cacheKey = `${sheetName}!${JSON.stringify(sparkline)}`;
            const padding = 3;
            canvas.customDrawWithCache(
              cacheKey,
              cellDisplayData.x + padding,
              cellDisplayData.y + padding,
              cellDisplayData.width - 2 * padding,
              cellDisplayData.height - 2 * padding,
              ctx => {
                renderSparkline(
                  ctx,
                  cellDisplayData.width - 2 * padding,
                  cellDisplayData.height - 2 * padding,
                  data,
                  sparklineGroup,
                  color => {
                    return currentSheet.dataProvider.getColor(color);
                  }
                );
              }
            );
          } else {
            console.warn('Target sheet not found', sheetName);
          }
        } else {
          console.warn('Unknown sparkline reference format', f);
        }
      }
    }
  }
}
