import {Pict} from '../../openxml/word/Pict';
import Word from '../../Word';

/**
 */

export function renderPict(word: Word, pict: Pict) {
  if (pict.src) {
    const img = document.createElement('img') as HTMLImageElement;
    img.style.position = 'relative';
    img.src = pict.src;
    return img;
  }
  return null;
}
