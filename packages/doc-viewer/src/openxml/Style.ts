/**
 */

import {parseTcPr} from '../word/parse/parseTcPr';
import {getVal} from '../OpenXML';
import Word from '../Word';
import {ST_StyleType, ST_TblStyleOverrideType} from './Types';
import {Paragraph, ParagraphPr} from './word/Paragraph';
import {Run, RunPr} from './word/Run';
import {TablePr} from './word/Table';
import {TcPr} from './word/table/Tc';
import {Tr, TrPr} from './word/table/Tr';
import {parseTablePr} from '../word/parse/parseTablePr';
import {parseTrPr} from '../word/parse/parseTrPr';

export interface CSSStyle {
  [key: string]: string | number;
}

// http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/tblStylePr.html
export interface TblStylePrStyle {
  // [comment removed]
  rPr?: RunPr;

  // [comment removed]
  pPr?: ParagraphPr;

  // [comment removed]
  tblPr?: TablePr;

  // [comment removed]
  trPr?: TrPr;

  // [comment removed]
  tcPr?: TcPr;
}

/**
 */
export interface Style extends TblStylePrStyle {
  id?: string;
  type?: ST_StyleType;
  name?: string;
  basedOn?: string;

  tblStylePr?: Record<ST_TblStyleOverrideType, TblStylePrStyle>;
}

/**
 */
export interface Styles {
  // [comment removed]
  styleMap: Record<string, Style>;

  defaultStyle?: Style;
}

/**
 */
function parseDefaultStyle(word: Word, element: Element | null) {
  const defaultStyle: Style = {};
  if (!element) {
    return defaultStyle;
  }
  const rPrDefault = element.getElementsByTagName('w:rPrDefault').item(0);
  if (rPrDefault) {
    const rPr = rPrDefault.getElementsByTagName('w:rPr').item(0);
    if (rPr) {
      defaultStyle.rPr = Run.parseRunPr(word, rPr);
    }
  }
  const pPrDefault = element.getElementsByTagName('w:pPrDefault').item(0);
  if (pPrDefault) {
    const pPr = pPrDefault.getElementsByTagName('w:pPr').item(0);
    if (pPr) {
      defaultStyle.pPr = Paragraph.parseParagraphPr(word, pPr);
    }
  }
  return defaultStyle;
}

function parseTblStylePr(word: Word, element: Element) {
  const style: TblStylePrStyle = {};
  for (let i = 0; i < (element.children || []).length; i++) {
    const child = (element.children || [])[i] as Element;
    const tag = child.tagName;
    switch (tag) {
      case 'w:rPr':
        style.rPr = Run.parseRunPr(word, child);
        break;

      case 'w:pPr':
        style.pPr = Paragraph.parseParagraphPr(word, child);
        break;

      case 'w:tblPr':
        style.tblPr = parseTablePr(word, child);
        break;

      case 'w:tcPr':
        style.tcPr = parseTcPr(word, child);
        break;

      case 'w:trPr':
        style.trPr = parseTrPr(word, child);
        break;
    }
  }

  return style;
}

/**
 */
function parseStyle(word: Word, element: Element) {
  const style: Style = {};

  style.id = element.getAttribute('w:styleId') || '';
  style.type = element.getAttribute('w:type') as ST_StyleType;

  style.tblStylePr = {} as Record<ST_TblStyleOverrideType, TblStylePrStyle>;

  Object.assign(style, parseTblStylePr(word, element));

  for (let i = 0; i < (element.children || []).length; i++) {
    const child = (element.children || [])[i] as Element;
    const tag = child.tagName;
    switch (tag) {
      case 'w:name':
        style.name = getVal(child);
        break;

      case 'w:basedOn':
        style.basedOn = getVal(child);
        break;

      case 'w:rPr':
      case 'w:pPr':
      case 'w:tblPr':
      case 'w:tcPr':
      case 'w:trPr':
        // [comment removed]
        break;

      case 'w:tblStylePr':
        const type = child.getAttribute('w:type') as ST_TblStyleOverrideType;
        style.tblStylePr[type] = parseTblStylePr(word, child);
        break;

      case 'w:next':
      case 'w:link':
      case 'w:unhideWhenUsed':
      case 'w:qFormat':
      case 'w:rsid':
      case 'w:uiPriority':
      case 'w:semiHidden':
      case 'w:autoRedefine':
        // [comment removed]
        break;

      default:
        console.warn('parseStyle Unknown tag', tag, child);
    }
  }

  return style;
}

/**
 */
export function parseStyles(word: Word, doc: Document): Styles {
  const styles: Styles = {
    styleMap: {}
  };

  const stylesElement = Array.from(doc.getElementsByTagName('w:style'));

  for (let styleElement of stylesElement) {
    const style = parseStyle(word, styleElement);
    if (style.id) {
      styles.styleMap[style.id] = style;
    }
  }

  styles.defaultStyle = parseDefaultStyle(
    word,
    doc.getElementsByTagName('w:docDefaults').item(0)
  );

  return styles;
}
