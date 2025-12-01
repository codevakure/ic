import {Workbook} from '../../Workbook';
import DOMPurify from 'dompurify';

/**
 */
export function handlePaste(e: ClipboardEvent, workbook: Workbook) {
  const html = e.clipboardData?.getData('text/html');
  if (!html) {
    return;
  }

  const element = document.createElement('div');
  element.innerHTML = DOMPurify.sanitize(html);

  const trs = element.querySelectorAll('table tr');

  // [comment removed]
}
