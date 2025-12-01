import {ST_TblLayoutType} from '../../openxml/Types';

import {getAttrBoolean, getVal, getValHex, getValNumber} from '../../OpenXML';
import {CSSStyle} from '../../openxml/Style';
import {TablePr, TblLookKey} from '../../openxml/word/Table';

import Word from '../../Word';
import {parseBorders} from './parseBorder';
import {parseInsideBorders} from './parseInsideBorders';
import {parseTblWidth} from './parseTblWidth';
import {parseShdColor} from './parseColor';
import {parseSize} from './parseSize';
import {parseTblCellSpacing} from './parseTcPr';
import {parseCellMargin} from './parseCellMargin';

/**
 * http://officeopenxml.com/WPtableAlignment.php
 */
function parseTblJc(element: Element, cssStyle: CSSStyle) {
  const val = getVal(element);
  switch (val) {
    case 'left':
    case 'start':
      // [comment removed]
      // cssStyle['float'] = 'left';
      break;
    case 'right':
    case 'end':
      cssStyle['float'] = 'right';
  }
}

/**
 * http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/tblInd_2.html
 */
function parseTblInd(element: Element, style: CSSStyle) {
  const width = parseTblWidth(element);
  if (width) {
    style['margin-left'] = width;
  }
}

function parseTblW(element: Element, style: CSSStyle) {
  const width = parseTblWidth(element);
  if (width) {
    style['width'] = width;
  }
}

// http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/ST_TblStyleOverrideType.html
// [comment removed]
function parseTblLook(child: Element) {
  const tblLook: Record<TblLookKey, boolean> = {} as Record<
    TblLookKey,
    boolean
  >;
  const tblLookVal = getValHex(child);
  if (getAttrBoolean(child, 'firstRow', false) || tblLookVal & 0x0020) {
    tblLook['firstRow'] = true;
  }
  if (getAttrBoolean(child, 'lastRow', false) || tblLookVal & 0x0040) {
    tblLook['lastRow'] = true;
  }
  if (getAttrBoolean(child, 'firstColumn', false) || tblLookVal & 0x0080) {
    tblLook['firstColumn'] = true;
  }
  if (getAttrBoolean(child, 'lastColumn', false) || tblLookVal & 0x0100) {
    tblLook['lastColumn'] = true;
  }
  if (getAttrBoolean(child, 'noHBand', false) || tblLookVal & 0x0200) {
    tblLook['noHBand'] = true;
  } else {
    tblLook['noHBand'] = false;
  }
  if (getAttrBoolean(child, 'noVBand', false) || tblLookVal & 0x0400) {
    tblLook['noVBand'] = true;
  } else {
    tblLook['noVBand'] = false;
  }

  return tblLook;
}

/**
 * http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/tblpPr.html
 */
function parseTblpPr(word: Word, child: Element, style: CSSStyle) {
  // [comment removed]
  if (typeof word.renderOptions.padding === 'undefined') {
    const tplpX = parseSize(child, 'w:tblpX');
    const tplpY = parseSize(child, 'w:tblpY');
    // style.position = 'absolute';
    style.top = tplpY;
    style.left = tplpX;
  }

  // [comment removed]
  // const topFromText = parseSize(child, 'w:topFromText');
  // const bottomFromText = parseSize(child, 'w:bottomFromText');
  // const rightFromText = parseSize(child, 'w:rightFromText');
  // const leftFromText = parseSize(child, 'w:leftFromText');
  // style['float'] = 'left';
  // style['margin-bottom'] = addSize(style['margin-bottom'], bottomFromText);
  // style['margin-left'] = addSize(style['margin-left'], leftFromText);
  // style['margin-right'] = addSize(style['margin-right'], rightFromText);
  // style['margin-top'] = addSize(style['margin-top'], topFromText);
}

/**
 * http://officeopenxml.com/WPtableLayout.php
 */
function parseTblLayout(element: Element, style: CSSStyle) {
  const type = element.getAttribute('w:type') as ST_TblLayoutType;

  if (type === 'fixed') {
    style['table-layout'] = 'fixed';
  }
}

export function parseTablePr(word: Word, element: Element): TablePr {
  const properties: TablePr = {};

  const tableStyle: CSSStyle = {};
  const tcStyle: CSSStyle = {};

  properties.tblLook = {} as Record<TblLookKey, boolean>;

  properties.cssStyle = tableStyle;
  properties.tcCSSStyle = tcStyle;

  for (let i = 0; i < (element.children || []).length; i++) {
    const child = (element.children || [])[i] as Element;
    const tagName = child.tagName;
    switch (tagName) {
      case 'w:tblBorders':
        parseBorders(word, child, tableStyle);
        properties.insideBorder = parseInsideBorders(word, child);
        break;

      case 'w:tcBorders':
        parseBorders(word, child, tableStyle);
        break;

      case 'w:tblInd':
        parseTblInd(child, tableStyle);
        break;

      case 'w:jc':
        parseTblJc(child, tableStyle);
        break;

      case 'w:tblCellMar':
      case 'w:tcMar':
        // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/tblCellMar_1.html
        parseCellMargin(child, tcStyle);
        break;

      case 'w:tblStyle':
        properties.pStyle = getVal(child);
        break;

      case 'w:tblW':
        parseTblW(child, tableStyle);
        break;

      case 'w:shd':
        // http://officeopenxml.com/WPtableShading.php
        tableStyle['background-color'] = parseShdColor(word, child);
        break;

      case 'w:tblCaption':
        properties.tblCaption = getVal(child);
        break;

      case 'w:tblCellSpacing':
        parseTblCellSpacing(child, tableStyle);
        break;

      case 'w:tblLayout':
        parseTblLayout(child, tableStyle);
        break;

      case 'w:tblLook':
        properties.tblLook = parseTblLook(child);
        break;

      case 'w:tblStyleRowBandSize':
        properties.rowBandSize = getValNumber(child);
        break;

      case 'w:tblStyleColBandSize':
        properties.colBandSize = getValNumber(child);
        break;

      case 'w:tblpPr':
        parseTblpPr(word, child, tableStyle);
        break;

      default:
        console.warn('parseTableProperties unknown tag', tagName, child);
    }
  }

  return properties;
}
