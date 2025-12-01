import {escapeHtml} from '../../../../util/escapeHTML';
import {Workbook} from '../../../Workbook';
import {RangeRef} from '../../../types/RangeRef';
import {MAX_COL, MAX_ROW} from '../../Consts';
import {cellToMergeCell} from '../../cell/cellToMergeCell';
import {cellInfoToStyle} from './cellInfoToStyle';

/**
 * @param workbook
 */
export function rangeToHTML(workbook: Workbook, range: RangeRef) {
  const currentSheet = workbook.getActiveSheet();

  let endRow = range.endRow;
  if (endRow === MAX_ROW) {
    endRow = currentSheet.getMaxRow();
  }
  let endCol = range.endCol;
  if (endCol === MAX_COL) {
    endCol = currentSheet.getMaxCol();
  }

  const mergeCells = currentSheet.getMergeCells();

  let tsv: string[] = [];

  let trs = '';
  for (let row = range.startRow; row <= endRow; row++) {
    const rowHeight = currentSheet.getRowHeight(row);
    trs += `<tr style="height: ${rowHeight}px">\n`;
    let tsvRow: string[] = [];
    for (let col = range.startCol; col <= endCol; col++) {
      const cellInfo = currentSheet.getCellInfo(row, col);
      const mergeCell = cellToMergeCell(row, col, mergeCells);
      const text = escapeHtml(cellInfo.text);
      const style = cellInfoToStyle(workbook, cellInfo);
      tsvRow.push(text);
      // [comment removed]
      if (
        mergeCell.startCol !== mergeCell.endCol &&
        row === mergeCell.startRow &&
        col === mergeCell.startCol
      ) {
        const rowSpan = mergeCell.endRow - mergeCell.startRow + 1;
        const colSpan = mergeCell.endCol - mergeCell.startCol + 1;
        col = mergeCell.endCol;
        trs += `  <td rowspan="${rowSpan}" colspan="${colSpan}" style="${style}">${text}</td>\n`;
        tsvRow.push(...Array(colSpan - 1).fill(''));
      } else {
        trs += `  <td style="${style}">${text}</td>\n`;
      }
    }
    tsv.push(tsvRow.join('\t'));
    trs += '</tr>\n';
  }

  // [comment removed]
  let cols = '';
  for (let col = range.startCol; col <= endCol; col++) {
    const colWidth = Math.floor(currentSheet.getColWidth(col));
    const widthPt = colWidth * 0.75;
    cols += `<col width=${colWidth} style="width: ${widthPt}pt;"></td>\n`;
  }

  // [comment removed]
  const table = `<table border=0 cellpadding=0 cellspacing=0 style='border-collapse:
  collapse;'>\n${cols}${trs}</table>`;

  return {table, tsv};
}
