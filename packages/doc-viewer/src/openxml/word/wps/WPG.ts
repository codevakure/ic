/**
 */

import {WPS} from './WPS';
import Word from '../../../Word';
import {ShapePr} from '../../drawing/ShapeProperties';
import {Pic} from '../../drawing/Pic';

export class WPG {
  wps: WPS[];
  // [comment removed]
  wpg: WPG[];
  spPr?: ShapePr;
  pic?: Pic;

  static fromXML(word: Word, element: Element) {
    const wpg = new WPG();
    const wps: WPS[] = [];
    wpg.wps = wps;
    wpg.wpg = [];
    for (let i = 0; i < (element.children || []).length; i++) {
      const child = (element.children || [])[i] as Element;
      const tagName = child.tagName;
      switch (tagName) {
        case 'wpg:cNvGrpSpPr':
          // [comment removed]
          break;

        case 'wpg:grpSpPr':
          wpg.spPr = ShapePr.fromXML(word, child);
          break;

        case 'wps:wsp':
          wps.push(WPS.fromXML(word, child));
          break;

        case 'pic:pic':
          wpg.pic = Pic.fromXML(word, child);
          break;

        case 'wpg:grpSp':
          // [comment removed]
          wpg.wpg.push(WPG.fromXML(word, child));
          break;

        default:
          console.warn('WPS: Unknown tag ', tagName, child);
      }
    }
    return wpg;
  }
}
