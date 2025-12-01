import {isSingleCell} from '../../io/excel/util/Range';
import {CellValue} from '../../types/CellValue';
import {FormulaEnv} from '../FormulaEnv';
import {ASTNode} from '../ast/ASTNode';
import {CellReference, NameReference} from '../ast/Reference';
import {EvalResult} from './EvalResult';
import {evalFormula} from './evalFormula';

export function visitReference(env: FormulaEnv, node: ASTNode): EvalResult {
  const ref = node.ref;
  if (!ref) {
    throw new Error("Reference node doesn't have ref");
  }

  if ('name' in ref) {
    return getResultByName(env, ref);
  } else {
    return getResultByRange(env, ref, env.getByRange(ref.range, ref.sheetName));
  }
}

function getResultByName(env: FormulaEnv, ref: NameReference) {
  const nameValue = env.getDefinedName(ref.name);
  return evalFormula(nameValue, env);
}

function getResultByRange(
  env: FormulaEnv,
  ref: CellReference,
  cellData: CellValue[]
): EvalResult {
  const range = ref.range;
  // [comment removed]
  if (isSingleCell(range)) {
    if (cellData.length === 0) {
      return undefined;
    }
    return cellData[0].value;
  }

  // [comment removed]
  const arrayResult: EvalResult[][] = [];
  const valueMap = new Map<string, CellValue['value']>();
  cellData.forEach(cellValue => {
    valueMap.set(cellValue.row + '-' + cellValue.col, cellValue.value);
  });

  for (let i = range.startRow; i <= range.endRow; i++) {
    const row: EvalResult[] = [];
    for (let j = range.startCol; j <= range.endCol; j++) {
      row.push(valueMap.get(i + '-' + j));
    }
    arrayResult.push(row);
  }
  return arrayResult;
}

export function visitReferenceIgnoreHidden(
  env: FormulaEnv,
  node: ASTNode
): EvalResult {
  const ref = node.ref;
  if (!ref) {
    throw new Error("Reference node doesn't have ref");
  }

  if ('name' in ref) {
    return getResultByName(env, ref);
  } else {
    return getResultByRange(
      env,
      ref,
      env.getByRangeIgnoreHidden(ref.range, ref.sheetName)
    );
  }
}
