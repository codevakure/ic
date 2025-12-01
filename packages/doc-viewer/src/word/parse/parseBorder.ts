/**
 */
import {CSSStyle} from '../../openxml/Style';
import {getVal} from '../../OpenXML';
import {parseColorAttr} from './parseColor';
import {LengthUsage, parseSize} from './parseSize';
import Word from '../../Word';
import {ST_Border} from '../../openxml/Types';

// [comment removed]
const DEFAULT_BORDER_COLOR = 'black';

/**
 */
export function parseBorder(word: Word, element: Element) {
  const type = getVal(element) as ST_Border;

  if (type === 'nil' || type === 'none') {
    return 'none';
  }

  let cssType = 'solid';

  // [comment removed]
  switch (type) {
    case 'dashed':
    case 'dashDotStroked':
    case 'dashSmallGap':
      cssType = 'dashed';
      break;
    case 'dotDash':
    case 'dotDotDash':
    case 'dotted':
      cssType = 'dotted';
      break;
    case 'double':
    case 'doubleWave':
      cssType = 'double';
      break;
    case 'inset':
      cssType = 'inset';
      break;
    case 'outset':
      cssType = 'outset';
      break;
  }

  const color = parseColorAttr(word, element);

  const size = parseSize(element, 'w:sz', LengthUsage.Border);

  return `${size} solid ${color == 'auto' ? DEFAULT_BORDER_COLOR : color}`;
}

/**
 */
export function parseBorders(word: Word, element: Element, style: CSSStyle) {
  for (let i = 0; i < (element.children || []).length; i++) {
    const child = (element.children || [])[i] as Element;
    const tagName = child.tagName;
    switch (tagName) {
      case 'w:start':
      case 'w:left':
        style['border-left'] = parseBorder(word, child);
        break;
      case 'w:end':
      case 'w:right':
        style['border-right'] = parseBorder(word, child);
        break;

      case 'w:top':
        style['border-top'] = parseBorder(word, child);
        break;

      case 'w:bottom':
        style['border-bottom'] = parseBorder(word, child);
        break;

      // [comment removed]
      default:
        break;
    }
  }
}
