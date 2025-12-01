import {CT_Marker, CT_PositiveSize2D} from '../../../openxml/ExcelTypes';
import {Sheet} from '../../sheet/Sheet';
import {emuToPx} from '../../../util/emuToPx';
import {findPositionInViewRange} from './findPositionInViewRange';
import {ViewRange} from '../../sheet/ViewRange';

export function getRectFromOneAnchorPoint(
  currentSheet: Sheet,
  cell: CT_Marker,
  viewRange: ViewRange,
  ext?: CT_PositiveSize2D
) {
  const cellRow = cell.row?.[0] || 0;
  const cellRowOffset = emuToPx(cell.rowOff?.[0]);

  const cellCol = cell.col?.[0] || 0;
  const cellColOffset = emuToPx(cell.colOff?.[0]);

  const cellPosition = findPositionInViewRange(
    currentSheet,
    cellRow,
    cellCol,
    viewRange
  );

  // Use ext dimensions if available (actual image size), otherwise fall back to offsets
  const width = ext?.cx ? emuToPx(ext.cx) : cellColOffset;
  const height = ext?.cy ? emuToPx(ext.cy) : cellRowOffset;

  return {
    x: cellPosition.x,
    y: cellPosition.y,
    width,
    height
  };
}

/**
 */

export function getRectFromTwoAnchorPoint(
  currentSheet: Sheet,
  from: CT_Marker,
  to: CT_Marker,
  viewRange: ViewRange
) {
  const fromRow = from.row?.[0] || 0;
  const fromRowOffset = emuToPx(from.rowOff?.[0]);

  const fromCol = from.col?.[0] || 0;
  const fromColOffset = emuToPx(from.colOff?.[0]);

  const toRow = to.row?.[0] || 0;
  const toRowOffset = emuToPx(to.rowOff?.[0]);
  const toCol = to.col?.[0] || 0;
  const toColOffset = emuToPx(to.colOff?.[0]);

  const fromPosition = findPositionInViewRange(
    currentSheet,
    fromRow,
    fromCol,
    viewRange
  );
  const toPosition = findPositionInViewRange(
    currentSheet,
    toRow,
    toCol,
    viewRange
  );

  const x = fromPosition.x + fromColOffset;
  const y = fromPosition.y + fromRowOffset;
  const rect = {
    x,
    y,
    width: toPosition.x + toColOffset - x,
    height: toPosition.y + toRowOffset - y
  };
  
  return rect;
}
