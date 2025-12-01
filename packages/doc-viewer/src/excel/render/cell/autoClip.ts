/**
 */

import {CellInfo} from '../../types/CellInfo';
import {IDataProvider} from '../../types/IDataProvider';
import {CellInfoWithSize} from './CellInfoWithSize';
import {measureTextWithCache} from './measureTextWithCache';
import {genFontStr} from './genFontStr';

export function autoClip(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  dataProvider: IDataProvider,
  cellInfoMap: Map<string, CellInfoWithSize>
) {
  for (const [key, cellInfo] of cellInfoMap) {
    const row = parseInt(key.split(',')[0]);
    const col = parseInt(key.split(',')[1]);

    const nextCol = col + 1;
    // [comment removed]
    if (cellInfoMap.has(`${row},${nextCol}`)) {
      const nextCellInfo = cellInfoMap.get(`${row},${nextCol}`)!;
      // [comment removed]
      if (
        cellInfo.alignment?.wrapText !== true &&
        cellInfo.text &&
        nextCellInfo.text
      ) {
        const fontStyle = dataProvider.getFontStyle(cellInfo.font);
        // [comment removed]
        const font = genFontStr(fontStyle);
        const size = measureTextWithCache(ctx, font, cellInfo.text);
        if (size.width > cellInfo.width) {
          cellInfo.needClip = true;
        }
      }
    }
  }
}
