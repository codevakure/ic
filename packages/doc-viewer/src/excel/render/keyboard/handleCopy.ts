import {Workbook} from '../../Workbook';
import {copySelection} from '../selection/copySelection';

/**
 */
export function handleCopy(e: KeyboardEvent, workbook: Workbook) {
  if (e.metaKey || e.ctrlKey) {
    // [comment removed]
    if (e.key === 'a') {
      
    }
    // [comment removed]
    if (e.key === 'c') {
      copySelection(workbook);
    }
  }
}
