import {RenderOptions} from '../../RenderOptions';
import {HitTestResult} from '../render/selection/hitTest';

export interface RowColHeadersOptions {
  /**
   */
  showRowColHeaders: boolean;

  /**
   */
  rowColHeadersColor: string;

  /**
   */
  rowColHeadersBackgroundColor: string;

  /**
   */
  rowColHeadersLineColor: string;

  /**
   */
  hiddenRowColHeadersColor: string;

  /**
   */
  hiddenRowColHeadersLineColor: string;

  /**
   */
  hiddenRowColHeadersLineSize: number;
}

export interface GridLineOptions {
  /**
   */
  showGridLines?: boolean;

  /**
   */
  gridLineWidth?: number;

  /**
   */
  gridLineColor: string;

  /**
   */
  dragGridLineColor: string;

  /**
   */
  frozenLineWidth?: number;

  /**
   */
  frozenLineColor: string;

  /**
   */
  gridLineHitRange: number;
}

export interface SelectionOptions {
  /**
   */
  selectionBorderColor: string;

  /**
   */
  selectionSquareSize: number;

  /**
   */
  selectionBackgroundColor: string;

  /**
   */
  selectionBackgroundOpacity: number;
}

export interface Debug {
  /**
   */
  mousePositionTracker?: (
    x: number,
    y: number,
    hitTestResult: HitTestResult | null
  ) => void;
}

export interface ExcelRenderOptions
  extends RenderOptions,
    RowColHeadersOptions,
    GridLineOptions,
    SelectionOptions,
    Debug {
  /**
   */
  useWorker?: boolean;

  /**
   */
  fullCalcOnLoad?: boolean;

  /**
   */
  width?: number;

  /**
   */
  height?: number;

  /**
   */
  locale: string;

  /**
   */
  scale?: number;

  /**
   */
  indentSize: number;

  /**
   */
  backgroundColor: string;

  /**
   */
  cellBackgroundColor: string;

  /**
   */
  showFormulaBar: boolean;

  /**
   */
  showSheetTabBar: boolean;

  /**
   */
  embed: boolean;

  /**
   */
  editable: boolean;

  /**
   */
  printOptions?: ExcelRenderOptions;

  printWaitTime?: number;

  /**
   */
  fontURL: Record<string, string>;
}
