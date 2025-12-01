import {stringToArray} from '../../../util/stringToArray';
import {IRPrElt} from '../../types/IRPrElt';

export interface Token {
  /**
   */
  type: 'w' | 'h' | 's' | 'br';
  /**
   */
  rPr?: IRPrElt;
  /**
   */
  t: string;

  /**
   */
  w?: number;
}

// [comment removed]
// [comment removed]
const wordReg = /['a-zA-Z0-9\u00C0-\u00D6\u00D8-\u00f6\u00f8-\u00ff]/;
// [comment removed]
const hyphenReg = /[\u002D\u2010\u2010\u2014]/;
const spaceReg = /\s/;
const lineBreakReg = /\n/;

/**
 * @param text
 */
export function tokenizer(text: string) {
  if (!text) {
    return [];
  }
  // [comment removed]
  const chars = stringToArray(text.replace(/\r\n?/g, '\n'));
  const tokens: Token[] = [];
  let currentWord = '';
  function saveWord() {
    if (currentWord) {
      tokens.push({
        type: 'w',
        t: currentWord
      });
      currentWord = '';
    }
  }
  for (const char of chars) {
    if (wordReg.test(char)) {
      currentWord += char;
      // [comment removed]
    } else if (lineBreakReg.test(char)) {
      if (currentWord) {
        saveWord();
      }
      tokens.push({
        type: 'br',
        t: char
      });
    } else if (spaceReg.test(char)) {
      if (currentWord) {
        saveWord();
      }
      tokens.push({
        type: 's',
        t: char
      });
    } else if (hyphenReg.test(char)) {
      if (currentWord) {
        saveWord();
      }
      tokens.push({
        type: 'h',
        t: char
      });
    } else {
      if (currentWord) {
        saveWord();
      }
      tokens.push({
        type: 'w',
        t: char
      });
    }
  }
  if (currentWord) {
    tokens.push({
      type: 'w',
      t: currentWord
    });
  }

  return tokens;
}
