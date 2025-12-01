import {CSSStyle} from '../../Style';
import {Paragraph} from '../Paragraph';
import {Table} from '../Table';
import {ST_Merge} from '../../Types';

export interface TcPr {
  cssStyle?: CSSStyle;

  // [comment removed]
  hideMark?: boolean;

  vMerge?: ST_Merge;

  gridSpan?: number;

  rowSpan?: number;

  /**
   */
  insideBorder?: {
    H?: string;
    V?: string;
  };
}

type TcChild = Paragraph | Table;

export class Tc {
  properties: TcPr = {};
  children: TcChild[] = [];

  add(child: TcChild) {
    if (child) {
      this.children.push(child);
    }
  }
}
