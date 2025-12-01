import Word from '../../Word';
import {parseBorder} from './parseBorder';

/**
 */
export function parseInsideBorders(word: Word, element: Element) {
  let H;
  const insideH = element.getElementsByTagName('w:insideH').item(0);
  if (insideH) {
    H = parseBorder(word, insideH);
  }

  let V;
  const insideV = element.getElementsByTagName('w:insideV').item(0);
  if (insideV) {
    V = parseBorder(word, insideV);
  }

  return {
    H,
    V
  };
}
