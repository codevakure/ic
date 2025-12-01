import {Paragraph} from '../Paragraph';
import {ShapePr} from '../../drawing/ShapeProperties';
/**
 */

import Word from '../../../Word';
import {Table} from '../Table';
import {parseTable} from '../../../word/parse/parseTable';
import {CSSStyle} from '../../../openxml/Style';
import {
  ST_TextAnchoringType,
  ST_TextVerticalType
} from '../../../openxml/Types';
import {convertAngle} from '../../../word/parse/parseSize';
import {WPSStyle} from './WPSStyle';

export type TxbxContentChild = Paragraph | Table;

/**
 */
function parseBodyPr(element: Element, style: CSSStyle) {
  for (let i = 0; i < (element.attributes || []).length; i++) {
    const attribute = (element.attributes || [])[i] as Attr;
    const name = attribute.name;
    const value = attribute.value;
    switch (name) {
      case 'numCol':
        if (value !== '1') {
          style['column-count'] = value;
        }
        break;

      case 'vert':
        const val = value as ST_TextVerticalType;
        switch (val) {
          case 'vert':
            style['writing-mode'] = 'vertical-rl';
            style['text-orientation'] = 'sideways';
            break;

          case 'vert270':
          case 'eaVert':
            // [comment removed]
            style['writing-mode'] = 'vertical-rl';
            style['text-orientation'] = 'mixed';
            break;

          default:
            break;
        }
        break;

      case 'anchor':
        const anchor = value as ST_TextAnchoringType;
        switch (anchor) {
          case 'b':
            style['vertical-align'] = 'bottom';
            break;
          case 't':
            style['vertical-align'] = 'top';
            break;
          case 'ctr':
            style['vertical-align'] = 'middle';
            break;
        }
        break;

      case 'rot':
        const rot = convertAngle(value);
        if (rot) {
          style['transform'] = `rotate(${rot}deg)`;
        }

        break;
    }
  }
}

export class WPS {
  spPr?: ShapePr;
  wpsStyle?: WPSStyle;
  txbxContent: TxbxContentChild[];
  // [comment removed]
  style: CSSStyle = {};

  static fromXML(word: Word, element: Element) {
    const wps = new WPS();
    wps.txbxContent = [];

    for (let i = 0; i < (element.children || []).length; i++) {
      const child = (element.children || [])[i] as Element;
      const tagName = child.tagName;
      switch (tagName) {
        case 'wps:cNvSpPr':
        case 'wps:cNvPr':
          // [comment removed]
          break;

        case 'wps:spPr':
          wps.spPr = ShapePr.fromXML(word, child);
          break;

        case 'wps:txbx':
          // [comment removed]
          // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/txbxContent.html
          const txbxContent = child.firstElementChild;
          if (txbxContent) {
            for (let j = 0; j < (txbxContent.children || []).length; j++) {
              const txbxContentChild = (txbxContent.children || [])[j] as Element;
              const txbxContentTagName = txbxContentChild.tagName;
              switch (txbxContentTagName) {
                case 'w:p':
                  wps.txbxContent.push(
                    Paragraph.fromXML(word, txbxContentChild)
                  );
                  break;

                case 'w:tbl':
                  wps.txbxContent.push(parseTable(word, txbxContentChild));
                  break;
              }
            }
          } else {
            console.warn('unknown wps:txbx', child);
          }
          break;

        case 'wps:style':
          // http://webapp.docx4java.org/OnlineDemo/ecma376/DrawingML/style_1.html
          wps.wpsStyle = WPSStyle.fromXML(word, child);
          break;

        case 'wps:bodyPr':
          parseBodyPr(child, wps.style);
          break;

        default:
          console.warn('WPS: Unknown tag ', tagName, child);
      }
    }

    return wps;
  }
}
