import {RangeRef} from '../../types/RangeRef';
import {FrozenViewRange} from '../cell/frozen/drawFrozen';
import {Position} from './Position';
import {hitTestInRange} from './hitTestInRange';
import {CellInfo} from '../../types/CellInfo';
import {
  IAbsoluteAnchor,
  IOneCellAnchor,
  ITwoCellAnchor
} from '../../types/IDrawing';
import {Region, ViewRange} from '../../sheet/ViewRange';

export type HitTestCommon = Position & RangeRef;

/**
 */
export type HitTestResult = HitTestCommon & {
  /**
   */
  type:
    | 'drawing' // [comment removed]
    | 'corner' // [comment removed]
    | 'cell' // [comment removed]
    | 'row-header' // [comment removed]
    | 'col-header' // [comment removed]
    | 'row-grid' // [comment removed]
    | 'col-grid'; // [comment removed]
  /**
   */
  region: Region;

  /**
   */
  drawing?: IOneCellAnchor | ITwoCellAnchor | IAbsoluteAnchor;

  /**
   */
  realRow?: number;

  /**
   */
  realCol?: number;
};

/**
 */
export function hitTest(
  offsetX: number,
  offsetY: number,
  rowHeaderWidth: number,
  colHeaderHeight: number,
  gridLineHitRange: number,
  viewRange: ViewRange | undefined,
  frozenViewRange: FrozenViewRange | undefined,
  mergeCells: RangeRef[]
): HitTestResult | null {
  // [comment removed]
  if (offsetX < rowHeaderWidth && offsetY < colHeaderHeight) {
    return {
      type: 'corner',
      region: 'normal',
      startRow: 0,
      startCol: 0,
      endCol: 0,
      endRow: 0,
      x: 0,
      y: 0,
      width: rowHeaderWidth,
      height: colHeaderHeight
    };
  }

  if (frozenViewRange) {
    const {topViewRange, leftViewRange, topLeftViewRange} = frozenViewRange;

    const hitTestTopLeft = hitTestInRange(
      'top-left-frozen',
      topLeftViewRange,
      offsetX,
      offsetY,
      rowHeaderWidth,
      colHeaderHeight,
      gridLineHitRange,
      mergeCells
    );
    if (hitTestTopLeft) {
      return hitTestTopLeft;
    }

    const hitTestLeft = hitTestInRange(
      'left-frozen',
      leftViewRange,
      offsetX,
      offsetY,
      rowHeaderWidth,
      colHeaderHeight,
      gridLineHitRange,
      mergeCells
    );

    if (hitTestLeft) {
      return hitTestLeft;
    }

    const hitTestTop = hitTestInRange(
      'top-frozen',
      topViewRange,
      offsetX,
      offsetY,
      rowHeaderWidth,
      colHeaderHeight,
      gridLineHitRange,
      mergeCells
    );
    if (hitTestTop) {
      return hitTestTop;
    }
  }

  return hitTestInRange(
    'normal',
    viewRange,
    offsetX,
    offsetY,
    rowHeaderWidth,
    colHeaderHeight,
    gridLineHitRange,
    mergeCells
  );
}
