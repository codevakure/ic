/**
 */

import Word from '../../../Word';
import {parseChildColor} from '../../../word/parse/parseChildColor';

export class WPSStyle {
  lineColor?: string;

  fillColor?: string;

  fontColor?: string;

  static fromXML(word: Word, element: Element) {
    const wpsStyle = new WPSStyle();

    for (let i = 0; i < (element.children || []).length; i++) {
      const child = (element.children || [])[i] as Element;
      const tagName = child.tagName;
      switch (tagName) {
        case 'a:fillRef':
          wpsStyle.fillColor = parseChildColor(
            c => word.getThemeColor(c),
            child
          );
          break;

        case 'a:lnRef':
          wpsStyle.lineColor = parseChildColor(
            c => word.getThemeColor(c),
            child
          );
          break;

        case 'a:fontRef':
          wpsStyle.fontColor = parseChildColor(
            c => word.getThemeColor(c),
            child
          );
          break;
      }
    }

    return wpsStyle;
  }
}
