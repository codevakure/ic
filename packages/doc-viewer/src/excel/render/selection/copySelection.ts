import {Workbook} from '../../Workbook';
import {rangeToHTML} from './buildHTML/rangeToHTML';

/**
 */
export function copySelection(workbook: Workbook) {
  const currentSheet = workbook.getActiveSheet();
  const selection = currentSheet.getSelection();
  if (!selection?.cellRanges) {
    console.warn('No selection');
    return;
  }

  if (selection.cellRanges.length === 0) {
    return;
  }

  const {tsv, table} = rangeToHTML(workbook, selection.cellRanges[0]);

  navigator.clipboard.write([
    new ClipboardItem({
      'text/plain': new Blob([tsv.join('\n')], {type: 'text/plain'}),
      'text/html': new Blob([table], {type: 'text/html'})
    })
  ]);
  workbook.uiEvent.emit('COPY_SELECTION');
}
