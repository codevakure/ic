/**
 */
export function isNumeric(str: string) {
  return !isNaN(parseFloat(str));
}
