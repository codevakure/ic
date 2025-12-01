import {CellValue} from '../types/CellValue';
import {RangeRef} from '../types/RangeRef';
import {CellData} from '../types/worksheet/CellData';
import {CellReference, NameReference, Reference} from './ast/Reference';
import {EvalResult} from './eval/EvalResult';

/**
 */
export interface FormulaEnv {
  /**
   */
  getDefinedName(name: string): string;

  /**
   */
  getByRange(range: RangeRef, sheetName?: string): CellValue[];

  /**
   * @param range
   * @param sheetName
   */
  getByRangeIgnoreHidden(range: RangeRef, sheetName?: string): CellValue[];

  /**
   */
  formulaCell(): RangeRef;
}

export function getRange(env: FormulaEnv, ref: Reference): RangeRef {
  // [comment removed]
  if ('name' in ref) {
    return {
      startRow: 0,
      startCol: 0,
      endRow: 0,
      endCol: 0
    };
  }
  return ref.range;
}
