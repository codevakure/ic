import {numberToLetters} from '../../io/excel/util/numberToLetters';
import {ExcelRenderOptions} from '../../sheet/ExcelRenderOptions';
import {Sheet} from '../../sheet/Sheet';
import {ViewRange} from '../../sheet/ViewRange';
import {FontSize} from '../../types/FontSize';
import {FontStyle} from '../../types/FontStyle';
import {SheetCanvas} from '../SheetCanvas';
import {genFontStr} from '../cell/genFontStr';

/**
 */
export function drawRowColHeaders(
  currentSheet: Sheet,
  viewRange: ViewRange,
  sheetCanvas: SheetCanvas,
  renderOptions: ExcelRenderOptions,
  defaultFontSize: FontSize,
  defaultFontStyle: FontStyle
) {
  if (currentSheet.showRowColHeaders() === false) {
    return;
  }
  const {rows, startRowOffset, height, width, cols, startColOffset} = viewRange;

  const {rowHeaderWidth, colHeaderHeight} = currentSheet.getRowColSize();

  const {
    gridLineColor,
    rowColHeadersBackgroundColor: rowColHeadersBgColor,
    hiddenRowColHeadersLineColor
  } = renderOptions;

  let currentRowOffset = startRowOffset;

  // [comment removed]
  sheetCanvas.drawRect(0, 0, rowHeaderWidth, height, rowColHeadersBgColor);

  const font = genFontStr(defaultFontStyle);
  const color = renderOptions.rowColHeadersColor;

  let hasHiddenRow = false;
  // [comment removed]
  for (let i of rows) {
    // [comment removed]
    const rowHeight = currentSheet.getRowHeight(i);

    // [comment removed]
    if (rowHeight === 0) {
      hasHiddenRow = true;
      continue;
    }

    // [comment removed]
    const lineY = currentRowOffset + colHeaderHeight;
    sheetCanvas.drawLine(
      {
        x1: 0,
        y1: lineY,
        x2: rowHeaderWidth,
        y2: lineY
      },
      gridLineColor
    );

    // [comment removed]
    if (hasHiddenRow) {
      // [comment removed]
      hasHiddenRow = false;
      sheetCanvas.drawLine(
        {
          x1: 0,
          y1: lineY,
          x2: rowHeaderWidth,
          y2: lineY
        },
        hiddenRowColHeadersLineColor,
        3
      );
    } else {
      sheetCanvas.drawLine(
        {
          x1: 0,
          y1: lineY,
          x2: rowHeaderWidth,
          y2: lineY
        },
        gridLineColor
      );
    }

    const textSize = String(i + 1).length;
    const textWidth = textSize * defaultFontSize.width;

    sheetCanvas.drawText(
      font,
      color,
      String(i + 1),
      (rowHeaderWidth - textWidth) / 2,
      currentRowOffset +
        (rowHeight - defaultFontSize.height) / 2 +
        colHeaderHeight,
      'top'
    );

    currentRowOffset += rowHeight;
  }

  // [comment removed]
  // sheetCanvas.drawLine(
  //   {
  //     x1: 0,
  //     y1: 0,
  //     x2: 0,
  //     y2: currentRowOffset + colHeaderHeight
  //   },
  //   gridLineColor
  // );

  // [comment removed]
  sheetCanvas.drawRect(0, 0, width, colHeaderHeight, rowColHeadersBgColor);

  let currentColOffset = startColOffset;

  // [comment removed]
  const colTextY = (colHeaderHeight - defaultFontSize.height) / 2;

  // [comment removed]
  // [comment removed]
  let lastColIndex = 0;

  for (let i of cols) {
    const colWidth = currentSheet.getColWidth(i);

    // [comment removed]
    const lineX = currentColOffset + rowHeaderWidth;

    // [comment removed]
    const hasHiddenCol = i - lastColIndex > 1;

    if (hasHiddenCol) {
      sheetCanvas.drawLine(
        {
          x1: lineX,
          y1: 0,
          x2: lineX,
          y2: colHeaderHeight
        },
        hiddenRowColHeadersLineColor,
        3
      );
    } else {
      sheetCanvas.drawLine(
        {
          x1: lineX,
          y1: 0,
          x2: lineX,
          y2: colHeaderHeight
        },
        gridLineColor
      );
    }

    // [comment removed]
    const text = numberToLetters(i);
    const textSize = text.length;
    const textWidth = textSize * defaultFontSize.width;

    sheetCanvas.drawText(
      font,
      color,
      text,
      currentColOffset + (colWidth - textWidth) / 2 + rowHeaderWidth,
      colTextY,
      'top'
    );

    currentColOffset += colWidth;
    lastColIndex = i;
  }

  // [comment removed]
  // sheetCanvas.drawLine(
  //   {
  //     x1: 0,
  //     y1: 0,
  //     x2: currentColOffset + rowHeaderWidth,
  //     y2: 0
  //   },
  //   gridLineColor
  // );

  // [comment removed]
  sheetCanvas.drawRect(
    0,
    0,
    rowHeaderWidth,
    colHeaderHeight,
    rowColHeadersBgColor
  );
}
