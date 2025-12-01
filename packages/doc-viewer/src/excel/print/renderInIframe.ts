import {Workbook} from '../Workbook';
import {MAX_COL, MAX_ROW} from '../render/Consts';
import {rangeToHTML} from '../render/selection/buildHTML/rangeToHTML';
import {printStyle} from './printStyle';

/**
 * @param iframe
 * @param workbook
 */
export function renderInIframe(iframe: HTMLIFrameElement, workbook: Workbook) {
  const printDocument = iframe.contentDocument!;

  const allRange = {
    startRow: 0,
    startCol: 0,
    endRow: MAX_ROW,
    endCol: MAX_COL
  };

  const {table} = rangeToHTML(workbook, allRange);

  let borderColor = workbook.renderOptions.gridLineColor;

  if (workbook.getActiveSheet().showGridLines() === false) {
    borderColor = 'transparent';
  }

  printDocument.write(printStyle(borderColor) + table);
}
