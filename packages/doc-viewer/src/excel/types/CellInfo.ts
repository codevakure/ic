import {
  CT_Border,
  CT_CellAlignment,
  CT_Fill,
  CT_Font
} from '../../openxml/ExcelTypes';
import {CellData} from './worksheet/CellData';
import {DataBarDisplay} from './DataBarDisplay';
import {IconNames} from '../io/excel/preset/presetIcons';

/**
 */

export interface CellInfo {
  /**
   */
  row: number;

  /**
   */
  col: number;

  /**
   */
  font: CT_Font;

  /**
   */
  fill?: CT_Fill;

  /**
   */
  border?: CT_Border;

  /**
   */
  text: string;

  /**
   */
  alignment?: CT_CellAlignment;

  /**
   */
  dataBarDisplay?: DataBarDisplay;

  /**
   */
  icon?: IconNames;

  /**
   */
  value: string;

  /**
   */
  cellData: CellData;

  /**
   */
  needClip?: boolean;
}
