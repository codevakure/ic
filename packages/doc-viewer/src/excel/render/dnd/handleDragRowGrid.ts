import {getCellRowPosition} from '../selection/getCellPosition';
import {dragState} from './handleMousedown';

/**
 */
export function handleDragRowGrid(mouseEvent: MouseEvent) {
  const {pageY} = mouseEvent;
  const shiftY = pageY - dragState.dragStart.pageY;
  const workbook = dragState.workbook!;
  const sheet = workbook.getActiveSheet();
  const rowPosition = getCellRowPosition(
    sheet,
    dragState.region,
    dragState.row
  );
  if (rowPosition) {
    // [comment removed]
    const startY = rowPosition.y + rowPosition.height;
    // [comment removed]
    let lineY = Math.max(rowPosition.y, startY + shiftY);

    dragState.tmpRowHeight = Math.max(0, lineY - rowPosition.y);

    workbook.uiEvent.emit('DRAG_ROW_GRID_LINE', lineY);
  }
}
