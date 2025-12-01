import {ExcelRenderOptions} from '../../../sheet/ExcelRenderOptions';
import {Sheet} from '../../../sheet/Sheet';
import {SheetCanvas} from '../../SheetCanvas';
import {IDataProvider} from '../../../types/IDataProvider';
import {drawTopFrozen} from './drawTopFrozen';
import {drawLeftFrozen} from './drawLeftFrozen';
import {drawTopLeftFrozen} from './drawTopLeftFrozen';
import {LinkPosition} from '../LinkPosition';
import {ExcelRender} from '../../ExcelRender';
import {ViewRange} from '../../../sheet/ViewRange';

export type FrozenViewRange = {
  topViewRange: ViewRange | null;
  leftViewRange: ViewRange | null;
  topLeftViewRange: ViewRange | null;
};

/**
 */
export function drawFrozen(
  excelRender: ExcelRender,
  currentSheet: Sheet,
  dataProvider: IDataProvider,
  excelRenderOptions: ExcelRenderOptions,
  mainCanvas: SheetCanvas,
  height: number,
  width: number,
  linkPositionCache: LinkPosition[]
): FrozenViewRange {
  let xSplit = 0;
  let ySplit = 0;
  let topViewRange: ViewRange | null = null;
  let leftViewRange: ViewRange | null = null;
  let topLeftViewRange: ViewRange | null = null;

  const currentSheetView = currentSheet.getCurrentSheetView();
  // [comment removed]
  if (currentSheetView?.pane) {
    const pane = currentSheetView?.pane;
    if (pane.xSplit) {
      xSplit = pane.xSplit;
    }
    if (pane.ySplit) {
      ySplit = pane.ySplit;
    }
  }

  if (xSplit > 0 && ySplit > 0) {
    const rangeResult = drawTopLeftFrozen(
      excelRender,
      xSplit,
      ySplit,
      currentSheet,
      dataProvider,
      excelRenderOptions,
      mainCanvas,
      height,
      width,
      linkPositionCache
    );
    topViewRange = rangeResult.topViewRange;
    leftViewRange = rangeResult.leftViewRange;
    topLeftViewRange = rangeResult.topLeftViewRange;
  } else if (ySplit > 0) {
    topViewRange = drawTopFrozen(
      excelRender,
      ySplit,
      currentSheet,
      dataProvider,
      excelRenderOptions,
      mainCanvas,
      width,
      linkPositionCache
    );
  } else if (xSplit > 0) {
    leftViewRange = drawLeftFrozen(
      excelRender,
      xSplit,
      currentSheet,
      dataProvider,
      excelRenderOptions,
      mainCanvas,
      height,
      linkPositionCache
    );
  }

  return {
    topViewRange,
    leftViewRange,
    topLeftViewRange
  };
}
