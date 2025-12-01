import {ST_UnderlineValues} from '../../openxml/ExcelTypes';

/**
 */

export interface FontStyle {
  family: string;
  size: number;
  color: string;
  b: boolean;
  i: boolean;
  strike: boolean;
  outline: boolean;
  shadow: boolean;
  u: ST_UnderlineValues;
  condense: boolean;
}
