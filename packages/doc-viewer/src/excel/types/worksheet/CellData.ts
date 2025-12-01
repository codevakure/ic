import {StringItem} from '../StringItem';

/**
 */
export type ErrorData = {
  type: 'error';
  value: string;
  s?: number;
};

/**
 */
export type FormulaData = {
  type: 'formula';
  formula: string;
  value: string;
  s?: number;
};

/**
 */
export type DateData = {
  type: 'date';
  value: string;
  s?: number;
};

/**
 */
export type StyleData = {
  type: 'style';
  s?: number;
  /**
   */
  value: string;
};

/**
 */
export type BlankData = {
  type: 'blank';
  s?: number;
};

/**
 */
export type CellData =
  | StringItem
  | ErrorData
  | FormulaData
  | StyleData
  | DateData
  | BlankData;

export function hasValue(cellData: CellData): boolean {
  if (typeof cellData === 'string') {
    return true;
  }
  // [comment removed]
  if (
    typeof cellData === 'object' &&
    (cellData.type === 'date' ||
      cellData.type === 'error' ||
      cellData.type === 'rich' ||
      cellData.type === 'style' ||
      cellData.type === 'formula')
  ) {
    return true;
  }
  return false;
}

/**
 * @param value
 * @param cellData
 * @returns
 */
export function updateValue(value: string = '', cellData?: CellData): CellData {
  if (!cellData) {
    return value || '';
  }

  if (typeof cellData === 'string') {
    return value;
  }

  if ('type' in cellData && cellData.type === 'blank') {
    if (cellData.s !== undefined) {
      return {
        type: 'style',
        value,
        s: cellData.s
      };
    }
    return value;
  }

  if ('value' in cellData) {
    return {
      ...cellData,
      value
    };
  }

  return cellData;
}
