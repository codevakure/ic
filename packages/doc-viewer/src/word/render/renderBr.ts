import Word from '../../Word';
import {Break} from '../../openxml/word/Break';
import {createElement} from '../../util/dom';

/**
 */
export function renderBr(word: Word, brak: Break) {
  if (brak.type === 'page') {
    word.breakPage = true;
  }
  const br = createElement('br');
  return br;
}
