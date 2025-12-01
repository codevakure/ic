import {Workbook} from '../../Workbook';
import {selectAll} from '../dnd/selectAll';

/**
 */
export function handleSelectAll(e: KeyboardEvent, workbook: Workbook) {
  if (e.metaKey || e.ctrlKey) {
    // [comment removed]
    if (e.key === 'a') {
      const sheetIndex = workbook.getActiveSheet().getIndex();
      workbook.uiEvent.emit('CHANGE_SELECTION', selectAll(sheetIndex));
      e.preventDefault();
    }
  }
}
