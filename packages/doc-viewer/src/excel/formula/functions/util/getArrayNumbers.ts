import {EvalResult} from '../../eval/EvalResult';
import {getNumber} from './getNumber';

/**
 *
 * @param args
 * @returns
 */
export function getArrayNumbers(args: EvalResult): number[] {
  const numbers: number[] = [];
  if (Array.isArray(args)) {
    for (const arg of args) {
      const num = getNumber(arg);
      if (num !== undefined) {
        numbers.push(num);
      }
    }
  } else {
    let num = getNumber(args);
    if (num !== undefined) {
      numbers.push(num);
    }
  }
  return numbers;
}
