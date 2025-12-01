import {EvalResult} from '../../eval/EvalResult';

/**
 */
export function getSingleValue(value: EvalResult): EvalResult {
  if (Array.isArray(value)) {
    return getSingleValue(value[0]);
  }
  return value;
}
