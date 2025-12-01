import {FunctionName} from '../builtinFunctions';
import {EvalResult} from '../eval/EvalResult';

// https://support.microsoft.com/en-us/office/excel-functions-by-category-5f91f4e9-7b42-46d2-9bd1-63f26a86c0eb?ui=en-us&rs=en-us&ad=us

type Func = (...args: EvalResult[]) => EvalResult;

export const functions: Map<FunctionName, Func> = new Map();

export function regFunc(name: FunctionName, func: Func) {
  if (functions.has(name)) {
    throw new Error(`function ${name} has been registered`);
  }
  functions.set(name, func);
}

// [comment removed]
const volatileFunctions = new Set(['RAND', 'RANDBETWEEN', 'NOW', 'TODAY']);

export function isVolatileFunction(functionName: FunctionName) {
  return volatileFunctions.has(functionName);
}
