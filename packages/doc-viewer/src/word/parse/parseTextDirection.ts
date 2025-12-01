import {CSSStyle} from '../../openxml/Style';
import {ST_TextDirection} from '../../openxml/Types';

export function parseTextDirection(element: Element, style: CSSStyle) {
  const val = element.getAttribute('w:val') as string;

  // [comment removed]
  // [comment removed]
  switch (val) {
    case 'lr':
    case 'lrV':
    case 'btLr':
    case 'lrTb':
    case 'lrTbV':
    case 'tbLrV':
      style['direction'] = 'ltr';
      break;

    case 'rl':
    case 'rlV':
    case 'tbRl':
    case 'tbRlV':
      style['direction'] = 'rtl';
      break;
  }
}
