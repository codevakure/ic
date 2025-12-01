import {getCellColPosition} from '../selection/getCellPosition';
import {dragState} from './handleMousedown';

/**
 */
export function handleDragColGrid(mouseEvent: MouseEvent) {
  const {pageX} = mouseEvent;
  const shiftX = pageX - dragState.dragStart.pageX;
  const workbook = dragState.workbook!;
  const sheet = workbook.getActiveSheet();
  const colPosition = getCellColPosition(
    sheet,
    dragState.region,
    dragState.col
  );
  if (colPosition) {
    // [comment removed]
    const startX = colPosition.x + colPosition.width;
    // [comment removed]
    let lineX = Math.max(colPosition.x, startX + shiftX);

    dragState.tmpColWidth = Math.max(0, lineX - colPosition.x);

    workbook.uiEvent.emit('DRAG_COL_GRID_LINE', lineX);
  }
}
