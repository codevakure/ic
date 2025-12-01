import {ST_TabTlc} from '../../openxml/Types';
import {Tab} from '../../openxml/word/Tab';
import {createElement} from '../../util/dom';
import Word from '../../Word';

/**
 * http://officeopenxml.com/WPtab.php
 */
export function renderTab(word: Word, tab: Tab, renderWidth = false) {
  const tabElement = createElement('span');
  tabElement.style.display = 'inline-block';
  tabElement.style.width = '2em';
  tabElement.innerHTML = '&emsp;';

  if (tab.leader === 'dot') {
    tabElement.style.borderBottom = '1pt dotted';
  }
  if (renderWidth && tab.pos && (tab.type === 'start' || tab.type == 'left')) {
    tabElement.style.width = tab.pos;
  }
  return tabElement;
}
