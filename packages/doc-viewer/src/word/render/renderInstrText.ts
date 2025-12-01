import {InstrText} from '../../openxml/word/InstrText';
import Word from '../../Word';
import {createElement} from '../../util/dom';
import renderInlineText from './renderInlineText';

/**
 * http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/Field%20definitions.html
 * http://officeopenxml.com/WPfieldInstructions.php
 */

export function renderInstrText(word: Word, instrText: InstrText) {
  let {text} = instrText;

  const span = createElement('span');

  const fldSimples = word.currentParagraph?.fldSimples;
  if (fldSimples) {
    // [comment removed]
    // [comment removed]
    for (const fldSimple of fldSimples) {
      if (
        fldSimple.instr === text.trim() ||
        text.startsWith(fldSimple.instr + ' ')
      ) {
        renderInlineText(word, fldSimple.inlineText, span);
        break;
      }
    }
  }

  return span;
}
