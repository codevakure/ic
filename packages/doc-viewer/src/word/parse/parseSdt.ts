/**
 * 17.5.2 Structured Document Tags
 */

export function parseSdt(element: Element, arr: Element[], index: number) {
  const sdtContent = element.getElementsByTagName('w:sdtContent').item(0);
  if (sdtContent) {
    arr.splice(index, 0, ...[].slice.call(sdtContent.children));
  }
}
