import FormulaError from '../../FormulaError';
import {EvalResult} from '../../eval/EvalResult';

/**
 * @param args
 * @returns
 */
export function get2DArrayOrThrow(args: EvalResult): EvalResult[][] {
  if (Array.isArray(args)) {
    if (Array.isArray(args[0])) {
      return args as EvalResult[][];
    }
  }
  throw FormulaError.VALUE;
}

/**
 * @param args
 * @returns
 */
export function get2DArray(args: EvalResult): EvalResult[][] | undefined {
  if (Array.isArray(args)) {
    if (Array.isArray(args[0])) {
      return args as EvalResult[][];
    } else {
      return [args];
    }
  } else {
    return undefined;
  }
}
