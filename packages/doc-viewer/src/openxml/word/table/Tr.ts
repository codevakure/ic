import {CSSStyle} from '../../Style';
import {Tc} from './Tc';

export interface TrPr {
  cssStyle?: CSSStyle;

  /**
   */
  tcStyle?: CSSStyle;
}

export class Tr {
  properties: TrPr = {};
  tcs: Tc[] = [];
}
