/**
 */

import {LengthUsage, convertLength} from '../../word/parse/parseSize';
import {CSSStyle} from './../Style';

import {getAttrBoolean, getAttrNumber, getValBoolean} from '../../OpenXML';
import Word from '../../Word';
import {Pic} from './Pic';
import {parseSize} from '../../word/parse/parseSize';
import {ST_RelFromH, ST_RelFromV} from '../Types';
import {WPS} from '../word/wps/WPS';
import {Diagram} from './diagram/Diagram';
import {WPG} from '../word/wps/WPG';

/**
 */
export enum Position {
  inline = 'inline',
  anchor = 'anchor'
}

/**
 * http://webapp.docx4java.org/OnlineDemo/ecma376/DrawingML/anchor_2.html
 */
export interface Anchor {
  simplePos: boolean;
  hidden?: boolean;
  behindDoc?: boolean;
}

function parseAnchor(element: Element): Anchor {
  const simplePos = getAttrBoolean(element, 'simplePos', false);
  const hidden = getAttrBoolean(element, 'hidden', false);
  const behindDoc = getAttrBoolean(element, 'behindDoc', false);
  return {
    simplePos,
    hidden,
    behindDoc
  };
}

export class Drawing {
  // [comment removed]
  pic?: Pic;
  // [comment removed]
  wps?: WPS;
  // [comment removed]
  wpg?: WPG;
  // [comment removed]
  diagram?: ConstrainDOMStringParameters;
  // [comment removed]
  position: Position = Position.inline;
  // [comment removed]
  anchor?: Anchor;
  // [comment removed]
  containerStyle?: CSSStyle;

  // [comment removed]
  relativeFromV: 'paragraph' | 'page';

  id?: string;
  name?: string;

  static fromXML(word: Word, element: Element): Drawing | null {
    const drawing = new Drawing();

    const containerStyle: CSSStyle = {};
    drawing.containerStyle = containerStyle;

    const position = element.firstElementChild;

    if (position) {
      if (position.tagName === 'wp:anchor') {
        drawing.position = Position.anchor;
        drawing.anchor = parseAnchor(position);
        const relativeHeight = getAttrNumber(position, 'relativeHeight', 1);
        containerStyle['z-index'] = relativeHeight;
      }

      for (let i = 0; i < (position.children || []).length; i++) {
        const child = (position.children || [])[i] as Element;
        const tagName = child.tagName;
        switch (tagName) {
          case 'wp:simplePos':
            // [comment removed]
            // [comment removed]
            if (drawing.anchor?.simplePos) {
              containerStyle['position'] = 'absolute';
              containerStyle['x'] = parseSize(child, 'x', LengthUsage.Emu);
              containerStyle['y'] = parseSize(child, 'y', LengthUsage.Emu);
            }
            break;

          case 'wp:positionH':
            const relativeFromH = child.getAttribute(
              'relativeFrom'
            ) as ST_RelFromH;
            if (
              relativeFromH === 'column' ||
              relativeFromH === 'page' ||
              relativeFromH === 'margin'
            ) {
              const positionType = child.firstElementChild;
              if (positionType) {
                const positionTypeTagName = positionType.tagName;
                containerStyle['position'] = 'absolute';
                if (positionTypeTagName === 'wp:posOffset') {
                  containerStyle['left'] = convertLength(
                    positionType.innerHTML,
                    LengthUsage.Emu
                  );
                } else {
                  containerStyle['left'] = '0';
                  console.warn('unsupport positionType', positionTypeTagName);
                }
              }
            } else {
              console.warn('unsupport positionH relativeFrom', relativeFromH);
            }
            break;

          case 'wp:positionV':
            const relativeFromV = child.getAttribute(
              'relativeFrom'
            ) as ST_RelFromV;
            if (relativeFromV === 'paragraph' || relativeFromV === 'page') {
              drawing.relativeFromV = relativeFromV;
              const positionType = child.firstElementChild;
              if (positionType) {
                const positionTypeTagName = positionType.tagName;
                containerStyle['position'] = 'absolute';
                if (positionTypeTagName === 'wp:posOffset') {
                  containerStyle['top'] = convertLength(
                    positionType.innerHTML,
                    LengthUsage.Emu
                  );
                } else {
                  containerStyle['top'] = '0';
                  console.warn('unsupport positionType', positionTypeTagName);
                }
              }
            } else {
              console.warn('unsupport positionV relativeFrom', relativeFromV);
            }
            break;

          case 'wp:docPr':
            drawing.id = child.getAttribute('id') || undefined;
            drawing.name = child.getAttribute('name') || undefined;
            break;

          case 'wp:cNvGraphicFramePr':
            // [comment removed]
            // http://webapp.docx4java.org/OnlineDemo/ecma376/DrawingML/docPr.html
            // http://webapp.docx4java.org/OnlineDemo/ecma376/DrawingML/cNvGraphicFramePr_1.html
            break;

          case 'a:graphic':
            const graphicData = child.firstElementChild;
            const graphicDataChild = graphicData?.firstElementChild;

            if (graphicDataChild) {
              const graphicDataChildTagName = graphicDataChild.tagName;

              switch (graphicDataChildTagName) {
                case 'pic:pic':
                  drawing.pic = Pic.fromXML(word, graphicDataChild);
                  break;

                case 'wps:wsp':
                  drawing.wps = WPS.fromXML(word, graphicDataChild);
                  break;

                case 'wpg:wgp':
                  drawing.wpg = WPG.fromXML(word, graphicDataChild);
                  break;

                case 'dgm:relIds':
                  // [comment removed]
                  // http://webapp.docx4java.org/OnlineDemo/ecma376/DrawingML/relIds.html
                  drawing.diagram = Diagram.fromXML(word, graphicDataChild);
                  break;

                default:
                  console.warn(
                    'unknown graphicData child tag',
                    graphicDataChild
                  );
              }
            }
            break;

          case 'wp:extent':
            containerStyle['width'] = parseSize(child, 'cx', LengthUsage.Emu);
            containerStyle['height'] = parseSize(child, 'cy', LengthUsage.Emu);
            break;

          case 'wp:effectExtent':
            // [comment removed]
            break;

          case 'wp:wrapNone':
            // [comment removed]
            // http://webapp.docx4java.org/OnlineDemo/ecma376/DrawingML/wrapNone.html
            break;

          case 'wp14:sizeRelH':
          case 'wp14:sizeRelV':
            // [comment removed]
            break;

          default:
            console.warn('drawing unknown tag', tagName);
        }
      }
    }

    return drawing;
  }
}
