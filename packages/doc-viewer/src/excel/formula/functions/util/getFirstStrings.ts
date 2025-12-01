import {EvalResult} from '../../eval/EvalResult';
import {getString} from './getString';

/**
 */
export function getFirstStrings(args: EvalResult[]): string[] {
  const strings: string[] = [];
  for (let arg of args) {
    if (Array.isArray(arg)) {
      if (arg.length > 0) {
        arg = arg[0];
      }
    }
    const str = getString(arg);
    if (str !== undefined) {
      strings.push(str);
    }
  }
  return strings;
}
