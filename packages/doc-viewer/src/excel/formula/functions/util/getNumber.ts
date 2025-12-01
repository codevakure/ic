import FormulaError from '../../FormulaError';
import {EvalResult} from '../../eval/EvalResult';

/**
 *
 * @param arg
 * @returns
 */
export function getNumber(
  arg: EvalResult,
  defaultValue?: number,
  booleanToNumber = false
): number | undefined {
  if (Array.isArray(arg)) {
    return getNumber(arg[0], defaultValue, booleanToNumber);
  }
  if (typeof arg === 'number') {
    if (!isFinite(arg)) {
      throw FormulaError.NUM;
    }
    return arg;
  }
  if (typeof arg === 'boolean') {
    return booleanToNumber ? (arg ? 1 : 0) : undefined;
  }
  if (typeof arg === 'string') {
    if (arg.endsWith('%')) {
      const num = Number(arg.slice(0, -1));
      if (!isNaN(num)) {
        if (!isFinite(num)) {
          throw FormulaError.NUM;
        }
        return num / 100;
      } else {
        return undefined;
      }
    } else {
      // [comment removed]
      const num = Number(arg);
      if (!isNaN(num)) {
        if (!isFinite(num)) {
          throw FormulaError.NUM;
        }
        return num;
      } else {
        return undefined;
      }
    }
  }

  if (defaultValue !== undefined) {
    return defaultValue;
  }

  return undefined;
}

export function getNumberOrThrow(
  arg: EvalResult,
  booleanToNumber = false
): number {
  if (Array.isArray(arg)) {
    arg = arg[0];
  }
  const number = getNumber(arg, undefined, booleanToNumber);
  if (number === undefined) {
    throw FormulaError.VALUE;
  }
  return number;
}

export function getNumberWithDefault(
  arg: EvalResult,
  defaultValue: number
): number {
  return getNumber(arg, defaultValue)!;
}
