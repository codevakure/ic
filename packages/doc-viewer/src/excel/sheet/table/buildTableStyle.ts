import {TableStyleDef} from '../../types/TableStyleDef';

/**
 */
export function buildTableStyle(tableStyle: TableStyleDef) {
  let wholeTable: undefined | number;
  let headerRow: undefined | number;
  let firstRowStripe: undefined | number;
  let firstColumnStripe: undefined | number;
  let totalRow: undefined | number;
  let firstColumn: undefined | number;
  let lastColumn: undefined | number;

  for (const tableStyleElement of tableStyle.tableStyles.tableStyle?.[0]
    ?.tableStyleElement || []) {
    const type = tableStyleElement.type;
    let dxfId = tableStyleElement.dxfId ?? 1;
    // [comment removed]
    dxfId = dxfId - 1;
    switch (type) {
      case 'wholeTable':
        wholeTable = dxfId;
        break;

      case 'headerRow':
        headerRow = dxfId;
        break;

      case 'firstRowStripe':
        firstRowStripe = dxfId;
        break;

      case 'firstColumnStripe':
        firstColumnStripe = dxfId;
        break;

      case 'totalRow':
        totalRow = dxfId;
        break;

      case 'firstColumn':
        firstColumn = dxfId;
        break;

      case 'lastColumn':
        lastColumn = dxfId;
        break;

      default:
        break;
    }
  }

  return {
    wholeTable,
    headerRow,
    firstRowStripe,
    firstColumnStripe,
    totalRow,
    firstColumn,
    lastColumn
  };
}
