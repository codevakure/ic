/**
 * http://officeopenxml.com/WPtable.php
 */

import {parseSize} from '../../word/parse/parseSize';
import Word from '../../Word';
import {CSSStyle} from '../Style';

import {Properties} from './properties/Properties';
import type {Tr} from './table/Tr';
import {parseTablePr} from '../../word/parse/parseTablePr';
import {Tc} from './table/Tc';
import {parseTr} from '../../word/parse/parseTr';

export type TblLookKey =
  | 'firstRow'
  | 'firstRow'
  | 'lastRow'
  | 'firstColumn'
  | 'lastColumn'
  | 'noHBand'
  | 'noVBand';

export interface TablePr extends Properties {
  /**
   */
  tblCaption?: string;

  /**
   */
  tcCSSStyle?: CSSStyle;

  /**
   */
  insideBorder?: {
    H?: string;
    V?: string;
  };

  /**
   */
  tblLook?: Record<TblLookKey, boolean>;

  /**
   */
  rowBandSize?: number;

  /**
   */
  colBandSize?: number;
}

export interface GridCol {
  w: string;
}

export class Table {
  properties: TablePr = {};
  tblGrid: GridCol[] = [];
  trs: Tr[] = [];
}
