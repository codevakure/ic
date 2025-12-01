import {EvalResult} from '../../eval/EvalResult';
import {flattenArgs} from './flattenArgs';
import {getNumber} from './getNumber';

/**
 *
 * @param args
 * @returns
 */
export function getNumbers(
  args: EvalResult[],
  process?: (arg: number | undefined, origin: EvalResult) => number | undefined,
  booleanToNumber = false
): number[] {
  const numbers: number[] = [];
  for (const arg of flattenArgs(args)) {
    let num = getNumber(arg, undefined, booleanToNumber);
    if (process) {
      num = process(num, arg);
    }
    if (num !== undefined) {
      numbers.push(num);
    }
  }
  return numbers;
}
