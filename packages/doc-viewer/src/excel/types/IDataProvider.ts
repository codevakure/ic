import {
  CT_Color,
  CT_ConditionalFormatting,
  CT_Dxf,
  CT_Font
} from '../../openxml/ExcelTypes';
import {Rect} from '../render/Rect';
import {HiddenRange} from '../sheet/getViewRange';
import {CellInfo} from './CellInfo';
import {CellValue} from './CellValue';
import {FontSize} from './FontSize';
import {FontStyle} from './FontStyle';
import {IDrawing} from './IDrawing';
import {ISheet} from './ISheet';
import {RangeRef} from './RangeRef';
import {CellData} from './worksheet/CellData';

/**
 */
export interface IDataProvider {
  /**
   */
  getSheetRowData(sheetIndex: number, row: number): CellData[];

  /**
   * @param sheetIndex
   * @param row
   * @param col
   */
  getCellData(
    sheetIndex: number,
    row: number,
    col: number
  ): CellData | undefined;

  /**
   * @param sheetIndex
   * @param row
   * @param col
   * @param data
   */
  updateCellData(
    sheetIndex: number,
    row: number,
    col: number,
    data: CellData
  ): void;

  /**
   * @param sheetIndex
   * @param row
   */
  getRowHeight(sheetIndex: number, row: number): number;

  /**
   * @param sheetIndex
   * @param col
   */
  getColWidth(sheetIndex: number, col: number): number;

  /**
   */
  getColHiddenRange(sheetIndex: number): HiddenRange[];

  /**
   */
  getMaxRow(sheetIndex: number): number;

  /**
   */
  isRowHidden(sheetIndex: number, row: number): boolean;

  /**
   */
  isColHidden(sheetIndex: number, col: number): boolean;

  /**
   */
  getTotalHeight(sheetIndex: number): number;

  /**
   */
  getMaxCol(sheetIndex: number): number;

  /**
   */
  getTotalWidth(sheetIndex: number): number;

  /**
   */
  getSheets(): ISheet[];

  /**
   * @param sheetIndex
   */
  getSheetByIndex(sheetIndex: number): ISheet | undefined;

  /**
   * @param sheetName
   */
  getSheetByName(sheetName: string): ISheet | undefined;

  /**
   */
  getCellInfo(sheetIndex: number, row: number, col: number): CellInfo;

  /**
   */
  getCellValue(sheetIndex: number, row: number, col: number): CellValue;

  /**
   */
  getCellValueByRange(
    sheetIndex: number,
    range: RangeRef,
    includeHidden: boolean
  ): CellValue[];

  /**
   */
  searchText(sheetIndex: number, text: string): CellValue[];

  /**
   */
  getColor(color?: CT_Color, defaultColor?: string): string | 'none';

  /**
   */
  getDefaultFontSize(): FontSize;

  /**
   */
  getDefaultFontStyle(): FontStyle;

  /**
   */
  getMergeCells(sheetIndex: number): RangeRef[];

  /**
   */
  getDrawing(sheetIndex: number): IDrawing | null;

  /**
   */
  getConditionalFormatting(sheetIndex: number): CT_ConditionalFormatting[];

  /**
   */
  getDxf(index: number): CT_Dxf | null;

  /**
   */
  getFontStyle(font?: CT_Font): FontStyle;

  /**
   * https://support.microsoft.com/en-us/office/date-systems-in-excel-e7fe7167-48a9-4b96-bb53-5612a800b487
   */
  is1904(): boolean;

  /**
   */
  sortColumn(
    sheetIndex: number,
    range: RangeRef,
    sortOrder: 'asc' | 'desc'
  ): void;

  /**
   */
  setRowHeight(sheetIndex: number, row: number, height: number): void;

  /**
   */
  setColWidth(sheetIndex: number, col: number, width: number): void;

  /**
   */
  clearDefaultFontSizeCache(): void;
}
