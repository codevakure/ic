import {Sheet} from '../../sheet/Sheet';
import {ViewRange} from '../../sheet/ViewRange';
import {renderAutoFilterIcon} from './renderAutoFilterIcon';

let tableId = 0;

export function renderAutoFilter(
  currentSheet: Sheet,
  dataContainer: HTMLElement
) {
  const autoFilter = currentSheet.getAutoFilter();

  if (autoFilter) {
    // [comment removed]
    renderAutoFilterIcon(
      currentSheet,
      autoFilter,
      'sheetAutoFilter',
      dataContainer
    );
  }

  // [comment removed]
  const tables = currentSheet.getTables();
  for (const table of tables) {
    if (table.autoFilter) {
      renderAutoFilterIcon(
        currentSheet,
        table.autoFilter,
        `table-${tableId++}`,
        dataContainer
      );
    }
  }
}
