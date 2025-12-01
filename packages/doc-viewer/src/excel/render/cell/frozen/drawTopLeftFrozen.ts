import {ExcelRenderOptions} from '../../../sheet/ExcelRenderOptions';
import {Sheet} from '../../../sheet/Sheet';
import {SheetCanvas} from '../../SheetCanvas';
import {drawGridLines} from '../../grid/drawGridLines';
import {drawCells} from '../drawCells';
import {drawRowColHeaders} from '../../header/drawRowColHeaders';
import {IDataProvider} from '../../../types/IDataProvider';
import {drawTopFrozen} from './drawTopFrozen';
import {drawLeftFrozen} from './drawLeftFrozen';
import {LinkPosition} from '../LinkPosition';
import {ExcelRender} from '../../ExcelRender';

/**
 */
export function drawTopLeftFrozen(
  excelRender: ExcelRender,
  xSplit: number,
  ySplit: number,
  currentSheet: Sheet,
  dataProvider: IDataProvider,
  excelRenderOptions: ExcelRenderOptions,
  mainCanvas: SheetCanvas,
  height: number,
  width: number,
  linkPositionCache: LinkPosition[]
) {
  // [comment removed]
  const topViewRange = drawTopFrozen(
    excelRender,
    ySplit,
    currentSheet,
    dataProvider,
    excelRenderOptions,
    mainCanvas,
    width,
    linkPositionCache
  );
  const leftViewRange = drawLeftFrozen(
    excelRender,
    xSplit,
    currentSheet,
    dataProvider,
    excelRenderOptions,
    mainCanvas,
    height,
    linkPositionCache
  );
  // [comment removed]
  const topLeftViewRange = currentSheet.getFrozenTopLeftViewPointRange(
    xSplit,
    ySplit
  );

  // [comment removed]
  const displayData = currentSheet.getViewPointData(topLeftViewRange);

  // [comment removed]
  mainCanvas.drawRect(
    0,
    0,
    topLeftViewRange.width,
    topLeftViewRange.height,
    excelRenderOptions.cellBackgroundColor
  );

  // [comment removed]
  drawCells(
    excelRender,
    currentSheet,
    excelRenderOptions,
    mainCanvas,
    displayData,
    linkPositionCache
  );

  // [comment removed]
  drawGridLines(
    currentSheet,
    topLeftViewRange,
    mainCanvas,
    topLeftViewRange.height,
    topLeftViewRange.width,
    excelRenderOptions
  );

  // [comment removed]
  drawRowColHeaders(
    currentSheet,
    topLeftViewRange,
    mainCanvas,
    excelRenderOptions,
    dataProvider.getDefaultFontSize(),
    dataProvider.getDefaultFontStyle()
  );

  // [comment removed]
  mainCanvas.drawLine(
    {
      x1: 0,
      y1: topViewRange.height,
      x2: topLeftViewRange.width,
      y2: topViewRange.height
    },
    excelRenderOptions.frozenLineColor
  );
  mainCanvas.drawLine(
    {
      x1: leftViewRange.width,
      y1: 0,
      x2: leftViewRange.width,
      y2: topLeftViewRange.height
    },
    excelRenderOptions.frozenLineColor
  );

  return {
    topViewRange,
    leftViewRange,
    topLeftViewRange
  };
}
