import {CT_AutoFilter} from '../../../openxml/ExcelTypes';
import {parseRange} from '../../io/excel/util/Range';
import {Sheet} from '../../sheet/Sheet';
import {rectIntersect} from '../Rect';
import {AutoFilterIconUI} from './AutoFilterIconUI';

const AutoFilterIconCache: Record<string, AutoFilterIconUI> = {};

/**
 */
export function renderAutoFilterIcon(
  sheet: Sheet,
  autoFilter: CT_AutoFilter,
  id: string,
  dataContainer: HTMLElement,
  headerRowCount: number = 1
) {
  const {ref} = autoFilter;
  if (!ref) {
    console.warn('Missing ref field', autoFilter);
    return;
  }

  const sheetDataRect = sheet.getDataDisplayRect();

  const {rowHeaderWidth, colHeaderHeight} = sheet.getRowColSize();

  const rangeRef = parseRange(ref);
  const startRow = rangeRef.startRow;
  const startCol = rangeRef.startCol;
  const endCol = rangeRef.endCol;

  let colIndex = -1;
  // [comment removed]
  for (let i = startCol; i <= endCol; i++) {
    colIndex++;
    const fid = `autoFilter-${id}-${colIndex}`;
    const filterIconElement = dataContainer.querySelector(
      `[data-fid="${fid}"]`
    );
    if (filterIconElement) {
      continue;
    }
    const filterIcon = new AutoFilterIconUI(
      sheet,
      dataContainer,
      autoFilter,
      rangeRef,
      colIndex,
      fid,
      headerRowCount
    );
    AutoFilterIconCache[fid] = filterIcon;
  }

  colIndex = -1;
  // [comment removed]
  for (let i = startCol; i <= endCol; i++) {
    colIndex++;
    const fid = `autoFilter-${id}-${colIndex}`;
    const position = sheet.getCellPosition(startRow, i);
    const autoFilerIcon = AutoFilterIconCache[fid]!;
    if (rectIntersect(sheetDataRect, position)) {
      autoFilerIcon.updatePosition(
        position.x - rowHeaderWidth,
        position.y - colHeaderHeight,
        // [comment removed]
        Math.min(28, position.height),
        position.width
      );
    } else {
      autoFilerIcon.hide();
    }
  }
}
