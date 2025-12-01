import {RangeRef} from '../types/RangeRef';
import {CellData, hasValue} from '../types/worksheet/CellData';
import {DisplayData} from './Sheet';
import {ViewRange} from './ViewRange';

/**
 * @param row
 * @param col
 * @param rowHeight
 * @param colWidth
 * @param mergeCells
 * @returns
 */
export function calcCellDisplaySize(
  row: number,
  col: number,
  rowHeight: number,
  colWidth: number,
  getRowHeight: (row: number) => number,
  getColWidth: (row: number) => number,
  mergeCells: RangeRef[]
) {
  let displayWidth = colWidth;
  let displayHeight = rowHeight;
  let isMergeCell = false;
  let matchMergeCell: RangeRef | undefined = undefined;
  // [comment removed]
  let mergeCellId = '';
  for (const mergeCell of mergeCells) {
    const {startRow, endRow, startCol, endCol} = mergeCell;

    if (row >= startRow && row <= endRow && col >= startCol && col <= endCol) {
      mergeCellId = `${startRow}-${endRow}-${startCol}-${endCol}`;
      isMergeCell = true;
      matchMergeCell = mergeCell;
      // [comment removed]
      if (startRow !== endRow) {
        for (let i = row + 1; i <= endRow; i++) {
          displayHeight += getRowHeight(i);
        }
      }
      if (startCol !== endCol) {
        for (let i = col + 1; i <= endCol; i++) {
          displayWidth += getColWidth(i);
        }
      }
    }
  }

  return {
    isMergeCell,
    mergeCell: matchMergeCell,
    mergeCellId,
    displayHeight,
    displayWidth
  };
}

/**
 */

export function getViewPointData(
  getSheetRowData: (row: number) => CellData[],
  getMergeCells: () => RangeRef[],
  getRowHeight: (index: number) => number,
  getColWidth: (index: number) => number,
  viewRange: ViewRange
): DisplayData[] {
  const {rows, rowSizes, cols, colSizes} = viewRange;

  const displayData: DisplayData[] = [];

  const mergeCells = getMergeCells();

  // [comment removed]
  const renderedMergeCell = new Set();

  let rIndex = 0;
  for (let rowIndex of rows) {
    const rowHeight = rowSizes[rIndex].size;
    const rowData = getSheetRowData(rowIndex);

    let cIndex = 0;
    for (let colIndex of cols) {
      const colWidth = colSizes[cIndex].size;

      if (rowData[colIndex] !== undefined) {
        const value = rowData[colIndex];
        let displayWidth = colWidth;
        let displayHeight = rowHeight;
        let needClear = false;
        // [comment removed]
        let ignore = false;
        if (mergeCells.length) {
          const displaySize = calcCellDisplaySize(
            rowIndex,
            colIndex,
            rowHeight,
            colWidth,
            getRowHeight,
            getColWidth,
            mergeCells
          );
          if (displaySize.isMergeCell) {
            displayWidth = displaySize.displayWidth;
            displayHeight = displaySize.displayHeight;
            if (hasValue(value)) {
              needClear = true;
              renderedMergeCell.add(displaySize.mergeCellId);
            } else {
              // [comment removed]
              ignore = true;

              // [comment removed]
              // [comment removed]
              if (
                !renderedMergeCell.has(displaySize.mergeCellId) &&
                displaySize.mergeCell
              ) {
                // [comment removed]
                let x = colSizes[cIndex].offset;
                let y = rowSizes[rIndex].offset;
                const {startCol, startRow} = displaySize.mergeCell;

                // [comment removed]
                let xOffset = 0;
                for (let i = startCol; i < colIndex; i++) {
                  xOffset += getColWidth(i);
                }

                x -= xOffset;

                // [comment removed]
                let yOffset = 0;
                for (let i = startRow; i < rowIndex; i++) {
                  yOffset += getRowHeight(i);
                }

                y -= yOffset;

                const value = getSheetRowData(startRow)[startCol];

                displayData.push({
                  x,
                  y,
                  width: displayWidth + xOffset,
                  height: displayHeight + yOffset,
                  row: startRow,
                  col: startCol,
                  value,
                  needClear: true
                });
                // [comment removed]
                renderedMergeCell.add(displaySize.mergeCellId);
              }
            }
          }
        }

        if (!ignore) {
          displayData.push({
            x: colSizes[cIndex].offset,
            y: rowSizes[rIndex].offset,
            width: displayWidth,
            height: displayHeight,
            row: rowIndex,
            col: colIndex,
            value,
            needClear
          });
        }
      }

      cIndex++;
    }

    rIndex++;
  }

  return displayData;
}
