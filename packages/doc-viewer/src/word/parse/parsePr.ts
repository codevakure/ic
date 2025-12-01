/**
 */

import {convertAngle, LengthUsage} from './parseSize';
import {CSSStyle} from '../../openxml/Style';
import Word from '../../Word';
import {getVal, getValBoolean, getValNumber} from '../../OpenXML';
import {parseBorder, parseBorders} from './parseBorder';
import {parseColor, parseColorAttr, parseShdColor} from './parseColor';
import {parseChildColor} from './parseChildColor';
import {parseInd} from './parseInd';
import {parseSize} from './parseSize';
import {parseSpacing} from './parseSpacing';
import {parseFont} from './parseFont';
import {ST_Em, ST_HighlightColor, ST_TextAlignment} from '../../openxml/Types';
import {parseTrHeight} from './parseTrHeight';
import {jcToTextAlign} from './jcToTextAlign';
import {parseTextDirection} from './parseTextDirection';
import {Color} from '../../util/color';

/**
 * http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/u.html
 */
function parseUnderline(word: Word, element: Element, style: CSSStyle) {
  const val = getVal(element);

  if (val == null) return;

  switch (val) {
    case 'dash':
    case 'dashDotDotHeavy':
    case 'dashDotHeavy':
    case 'dashedHeavy':
    case 'dashLong':
    case 'dashLongHeavy':
    case 'dotDash':
    case 'dotDotDash':
      style['text-decoration-style'] = 'dashed';
      break;

    case 'dotted':
    case 'dottedHeavy':
      style['text-decoration-style'] = 'dotted';
      break;

    case 'double':
      style['text-decoration-style'] = 'double';
      break;

    case 'single':
    case 'thick':
      style['text-decoration'] = 'underline';
      break;

    case 'wave':
    case 'wavyDouble':
    case 'wavyHeavy':
      style['text-decoration-style'] = 'wavy';
      break;

    case 'words':
      style['text-decoration'] = 'underline';
      break;

    case 'none':
      style['text-decoration'] = 'none';
      break;
  }

  const color = parseColorAttr(word, element);

  if (color) {
    style['text-decoration-color'] = color;
  }
}

/**
 * http://officeopenxml.com/WPparagraph-textFrames.php
 */
function parseFrame(element: Element, style: CSSStyle) {
  for (let ai = 0; ai < (element.attributes || []).length; ai++) {
    const attribute = (element.attributes || [])[ai] as Attr;
    const name = attribute.name;
    const value = attribute.value;
    switch (name) {
      case 'w:dropCap':
        if (value === 'drop') {
          // [comment removed]
          style['float'] = 'left';
        }
        break;

      case 'w:h':
        if (typeof value === 'object' && !Array.isArray(value)) {
          style['height'] = parseSize(value, 'w:h');
        }
        break;

      case 'w:w':
        if (typeof value === 'object' && !Array.isArray(value)) {
          style['width'] = parseSize(value, 'w:w');
        }
        break;

      case 'w:hAnchor':
      case 'w:vAnchor':
      case 'w:lines':
        // [comment removed]
        break;

      case 'w:wrap':
        // [comment removed]
        if (value !== 'around') {
          console.warn('parseFrame: w:wrap not support ' + value);
        }

        break;

      default:
        console.warn('parseFrame: unknown attribute ' + name, attribute);
    }
  }
}

/**
 * http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/ST_Em.html
 */
function convertEm(em: ST_Em, style: CSSStyle) {
  switch (em) {
    case 'dot':
      style['text-emphasis'] = 'filled';
      // [comment removed]
      // [comment removed]
      style['text-emphasis-position'] = 'under right';
      break;
    case 'comma':
      style['text-emphasis'] = 'filled sesame';
      break;

    case 'circle':
      style['text-emphasis'] = 'open';
      break;

    case 'underDot':
      style['text-emphasis'] = 'filled';
      style['text-emphasis-position'] = 'under right';
      break;
    case 'none':
      break;
  }
}

const HighLightColor = 'transparent';

/**
 */
export function parsePr(word: Word, element: Element, type: 'r' | 'p' = 'p') {
  let style: CSSStyle = {};
  for (let i = 0; i < (element.children || []).length; i++) {
    const child = (element.children || [])[i] as Element;
    const tagName = child.tagName;
    switch (tagName) {
      case 'w:sz':
      case 'w:szCs':
        style['font-size'] = parseSize(child, 'w:val', LengthUsage.FontSize);
        break;

      case 'w:jc':
        style['text-align'] = jcToTextAlign(getVal(child));
        break;

      case 'w:framePr':
        parseFrame(child, style);
        break;

      case 'w:pBdr':
        parseBorders(word, child, style);
        break;

      case 'w:ind':
        parseInd(child, style);
        break;

      case 'w:color':
        style['color'] = parseColor(word, child);
        break;

      case 'w:shd':
        // [comment removed]
        if (!('background-color' in style)) {
          // http://officeopenxml.com/WPshading.php
          style['background-color'] = parseShdColor(word, child);
        }
        break;

      case 'w:spacing':
        parseSpacing(word, child, style);
        break;

      case 'w:highlight':
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/highlight.html
        // [comment removed]
        style['background-color'] = parseColorAttr(
          word,
          child,
          'w:val',
          'yellow'
        );
        break;

      case 'w:vertAlign':
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/vertAlign.html
        // [comment removed]
        const vertAlign = getVal(child);
        if (vertAlign === 'superscript') {
          style['vertical-align'] = 'super';
        } else if (vertAlign === 'subscript') {
          style['vertical-align'] = 'sub';
        }
        break;

      case 'w:position':
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/position.html
        style['vertical-align'] = parseSize(
          child,
          'w:val',
          LengthUsage.FontSize
        );
        break;

      case 'w:trHeight':
        parseTrHeight(child, style);
        break;

      case 'w:strike':
      case 'w:dstrike':
        // [comment removed]
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/dstrike.html
        style['text-decoration'] = getValBoolean(child)
          ? 'line-through'
          : 'none';
        break;

      case 'w:b':
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/b.html
        style['font-weight'] = getValBoolean(child) ? 'bold' : 'normal';
        break;

      case 'w:adjustRightInd':
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/adjustRightInd.html
        // [comment removed]
        break;

      case 'w:bCs':
      case 'w:iCs':
        // [comment removed]
        break;

      case 'w:i':
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/i.html
        style['font-style'] = getValBoolean(child) ? 'italic' : 'normal';
        break;

      case 'w:caps':
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/caps.html
        style['text-transform'] = getValBoolean(child) ? 'uppercase' : 'normal';
        break;

      case 'w:smallCaps':
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/smallCaps.html
        style['text-transform'] = getValBoolean(child) ? 'lowercase' : 'normal';
        break;

      case 'w:u':
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/u.html
        parseUnderline(word, child, style);
        break;

      case 'w:rFonts':
        parseFont(word, child, style);
        break;

      case 'w:tblCellSpacing':
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/tblCellSpacing_1.html
        style['border-spacing'] = parseSize(child, 'w:w');
        style['border-collapse'] = 'separate';
        break;

      case 'w:bdr':
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/bdr.html
        style['border'] = parseBorder(word, child);
        break;

      case 'w:vanish':
        if (getValBoolean(child)) {
          // [comment removed]
          style['display'] = 'none';
        }
        break;

      case 'w:kern':
        // [comment removed]
        // style['letter-spacing'] = parseSize(
        //   child,
        //   'w:val',
        //   LengthUsage.FontSize
        // );
        break;

      case 'w:pStyle':
        // [comment removed]
        break;

      case 'w:lang':
      case 'w:noProof':
        // [comment removed]
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/lang.html
        break;

      case 'w:keepLines':
      case 'w:keepNext':
      case 'w:widowControl':
      case 'w:pageBreakBefore':
        // [comment removed]
        break;

      case 'w:outlineLvl':
        // [comment removed]
        break;

      case 'w:contextualSpacing':
        // [comment removed]
        break;

      case 'w:numPr':
        // [comment removed]
        break;

      case 'w:rPr':
        // [comment removed]
        const reflection = child.getElementsByTagName('w14:reflection').item(0);
        if (reflection) {
          // [comment removed]
          // [comment removed]
          const reflectionDistance =
            parseSize(reflection, 'w4:dist', LengthUsage.Emu) || '0px';
          style[
            '-webkit-box-reflect'
          ] = `below ${reflectionDistance} linear-gradient(transparent, white)`;
        }
        break;

      case 'w:rStyle':
        // [comment removed]
        break;

      case 'w:webHidden':
        // [comment removed]
        style['display'] = 'none';
        break;

      case 'w:tabs':
        // [comment removed]
        break;

      case 'w:snapToGrid':
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/snapToGrid_2.html
        // [comment removed]
        break;

      case 'w:topLinePunct':
        // [comment removed]
        break;

      case 'w:wordWrap':
        // [comment removed]
        if (getValBoolean(child)) {
          style['word-break'] = 'break-all';
        }
        break;

      case 'w:textAlignment':
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/textAlignment.html
        const alignment = getVal(child) as ST_TextAlignment;
        if (alignment === 'center') {
          style['vertical-align'] = 'middle';
        } else if (alignment !== 'auto') {
          style['vertical-align'] = alignment;
        }
        break;

      case 'w:textDirection':
        parseTextDirection(child, style);
        break;

      case 'w:cnfStyle':
        // [comment removed]
        break;

      case 'w:bidi':
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/bidi_1.html
        // [comment removed]
        if (getValBoolean(child, true)) {
          console.warn('w:bidi is not supported.');
        }
        break;

      case 'w:autoSpaceDE':
      case 'w:autoSpaceDN':
        // [comment removed]
        break;

      case 'w:kinsoku':
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/kinsoku.html
        // [comment removed]
        break;

      case 'w:overflowPunct':
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/overflowPunct.html
        // [comment removed]
        break;

      case 'w:em':
        convertEm(getVal(child) as ST_Em, style);
        break;

      case 'w:w':
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/w_1.html
        // [comment removed]
        const w = getValNumber(child);
        style['transform'] = `scaleX(${w / 100})`;
        style['display'] = 'inline-block'; // [comment removed]
        break;

      case 'w:outline':
        style['text-shadow'] =
          '-1px -1px 0 #AAA, 1px -1px 0 #AAA, -1px 1px 0 #AAA, 1px 1px 0 #AAA';
        break;

      case 'w:shadown':
      case 'w:imprint':
        if (getValBoolean(child, true)) {
          style['text-shadow'] = '1px 1px 2px rgba(0, 0, 0, 0.6)';
        }
        break;

      case 'w14:shadow':
        const blurRad =
          parseSize(child, 'w14:blurRad', LengthUsage.Emu) || '4px';
        // [comment removed]
        let color = 'rgba(0, 0, 0, 0.6)';
        const childColor = parseChildColor(c => word.getThemeColor(c), child);
        if (childColor) {
          color = childColor;
        }
        style['text-shadow'] = `1px 1px ${blurRad} ${color}`;
        break;

      case 'w14:textOutline':
        const outlineWidth =
          parseSize(child, 'w14:w', LengthUsage.Emu) || '1px';

        style['-webkit-text-stroke-width'] = outlineWidth;

        let outlineColor = 'white';
        const fillColor = child.getElementsByTagName('w14:solidFill');
        if (fillColor.length > 0) {
          outlineColor =
            parseChildColor(c => word.getThemeColor(c), fillColor.item(0)!) ||
            'white';
        }

        style['-webkit-text-stroke-color'] = outlineColor;
        break;

      case 'w14:reflection':
        // [comment removed]
        break;

      case 'w14:textFill':
        // [comment removed]
        break;

      case 'w14:ligatures':
        // [comment removed]
        break;

      default:
        console.warn('parsePr Unknown tagName', tagName, child);
    }
  }

  return style;
}
