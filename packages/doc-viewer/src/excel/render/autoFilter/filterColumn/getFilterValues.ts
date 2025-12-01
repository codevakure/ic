import {CT_AutoFilter} from '../../../../openxml/ExcelTypes';

/**
 */
export function getFilterValues(autoFilter: CT_AutoFilter, colIndex: number) {
  const filterValues: Set<string> = new Set();

  const filterColumn = autoFilter.filterColumn?.find(
    column => column.colId === colIndex
  );

  if (filterColumn) {
    for (const filter of filterColumn.filters?.filter || []) {
      if (filter.val) {
        filterValues.add(filter.val);
      }
    }
  }

  return filterValues;
}
