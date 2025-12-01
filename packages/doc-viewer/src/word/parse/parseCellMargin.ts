import {CSSStyle} from '../../openxml/Style';
import {parseSize} from './parseSize';

// http://officeopenxml.com/WPtableCellProperties-Margins.php
export function parseCellMargin(element: Element, style: CSSStyle) {
  for (let i = 0; i < (element.children || []).length; i++) {
    const child = (element.children || [])[i] as Element;
    const tagName = child.tagName;
    switch (tagName) {
      case 'w:left':
      case 'w:start':
        style['padding-left'] = parseSize(child, 'w:w');
        break;

      case 'w:right':
      case 'w:end':
        style['padding-right'] = parseSize(child, 'w:w');
        break;

      case 'w:top':
        style['padding-top'] = parseSize(child, 'w:w');
        break;

      case 'w:bottom':
        style['padding-bottom'] = parseSize(child, 'w:w');
        break;
    }
  }
}
