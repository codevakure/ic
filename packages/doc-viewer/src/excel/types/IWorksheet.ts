import {
  CT_AutoFilter,
  CT_Col,
  CT_ConditionalFormatting,
  CT_Row,
  CT_SheetFormatPr,
  CT_SheetPr,
  CT_SheetView,
  CT_Table
} from '../../openxml/ExcelTypes';
import {CT_ExtensionList} from './CT_ExtensionList';
import {IDrawing} from './IDrawing';
import {RangeRef} from './RangeRef';

import {CellData} from './worksheet/CellData';

/**
 */
export interface IWorksheet {
  sheetPr?: CT_SheetPr;

  dimension?: {
    ref: string;
  };

  sheetViews?: CT_SheetView[];

  sheetFormatPr?: CT_SheetFormatPr;

  cols: CT_Col[];

  /**
   */
  rows: CT_Row[];

  /**
   */
  cellData: CellData[][];

  mergeCells: RangeRef[];

  /**
   */
  conditionalFormatting: CT_ConditionalFormatting[];

  /**
   */
  drawing?: IDrawing;

  extLst?: CT_ExtensionList;

  tableParts?: CT_Table[];

  autoFilter?: CT_AutoFilter;
}
