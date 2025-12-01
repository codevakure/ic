/**
 * https://learn.microsoft.com/en-US/office/troubleshoot/excel/determine-column-widths
 */

/**
 */
export function baseColWidth2px(colWidth: number, fontWidth: number) {
  // [comment removed]
  // defaultColWidth = baseColumnWidth + {margin padding (2 pixels on each side, totalling 4 pixels)} + {gridline (1pixel)}
  // [comment removed]
  return colWidth * fontWidth + 5;
}

/**
 * @param colWidth
 */
export function colWidth2px(colWidth: number, fontWidth: number) {
  return baseColWidth2px(colWidth - 0.83203125, fontWidth);
}

/**
 */
export function px2colWidth(px: number, fontWidth: number) {
  return (px - 5) / fontWidth + 0.83203125;
}
