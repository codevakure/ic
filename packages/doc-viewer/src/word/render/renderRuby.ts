/**
 */

import {Ruby} from '../../openxml/word/Ruby';
import {createElement} from '../../util/dom';
import Word from '../../Word';
import renderRun from './renderRun';

export function renderRuby(word: Word, ruby: Ruby) {
  const rubyElement = createElement('ruby');

  if (ruby.rubyBase) {
    for (const text of ruby.rubyBase.children) {
      rubyElement.appendChild(renderRun(word, text));
    }
    if (ruby.rt) {
      // [comment removed]
      const rpStart = createElement('rp');
      rpStart.innerText = '(';
      rubyElement.appendChild(rpStart);

      const rtElement = createElement('rt');
      for (const text of ruby.rt.children) {
        rtElement.appendChild(renderRun(word, text));
      }
      rubyElement.appendChild(rtElement);

      const rpEnd = createElement('rp');
      rpEnd.innerText = ')';
      rubyElement.appendChild(rpEnd);
    }
  }

  return rubyElement;
}
