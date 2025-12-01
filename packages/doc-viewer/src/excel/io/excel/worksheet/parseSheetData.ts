import {CT_Row, CT_Row_Attributes} from '../../../../openxml/ExcelTypes';
import {XMLNode} from '../../../../util/xml';
import {StringItem} from '../../../types/StringItem';
import {ICell, CT_Cell_Attributes} from '../../../types/worksheet/ICell';

import {CellData, BlankData} from '../../../types/worksheet/CellData';
import {decodeAddress} from '../util/decodeAddress';
import {autoParse} from '../../../../common/autoParse';

/**
 */

export function parseSheetData(
  sheetDataNode: XMLNode,
  sharedStrings: StringItem[]
) {
  const rows: CT_Row[] = [];
  const cellData: CellData[][] = [];

  for (const rowNode of sheetDataNode.children || []) {
    // [comment removed]
    const row = autoParse(rowNode, CT_Row_Attributes) as CT_Row;
    // [comment removed]
    const r = (row.r || 1) - 1;
    rows[r] = row;

    for (const cellNode of rowNode.children || []) {
      const cell = autoParse(cellNode, CT_Cell_Attributes) as ICell;
      const cellType = cell.t;
      const styleIndex = cell.s;
      /**
       */
      const colNumber = decodeAddress(cell.r!).col!;
      // [comment removed]
      let value: CellData = '';
      let formula = '';
      for (const cellNodeChild of cellNode.children || []) {
        const tag = cellNodeChild.tag;
        switch (tag) {
          case 'v':
            // shared string
            if (cellType === 's') {
              const index = parseInt(cellNodeChild.text || '');
              value = sharedStrings[index];
            } else if (cellType == 'd') {
              value = {
                type: 'date',
                value: cellNodeChild.text || ''
              };
            } else {
              value = cellNodeChild.text || '';
            }
            break;
          case 'f':
            formula = cellNodeChild.text || '';
            break;

          case 'is':
            // [comment removed]
            for (const isNode of cellNodeChild.children || []) {
              const tag = isNode.tag;
              if (tag === 't' && cellType === 'inlineStr') {
                value = isNode.text || '';
              }
            }
            break;

          default:
            break;
        }

        if (formula && typeof value === 'string') {
          value = {
            type: 'formula',
            formula,
            value: value
          };
        }

        if (styleIndex) {
          if (typeof value === 'string') {
            value = {
              type: 'style',
              s: styleIndex,
              value: value
            };
          } else if (typeof value === 'object') {
            value.s = styleIndex;
          }
        }

        if (cellData[r]) {
          cellData[r][colNumber] = value;
        } else {
          cellData[r] = [];
          cellData[r][colNumber] = value;
        }
      }
      // [comment removed]
      if (!cellNode.children || cellNode.children.length === 0) {
        const emptyValue: BlankData = {
          type: 'blank',
          s: styleIndex
        };
        if (cellData[r]) {
          cellData[r][colNumber] = emptyValue;
        } else {
          cellData[r] = [];
          cellData[r][colNumber] = emptyValue;
        }
      }
    }
  }

  return {
    rows,
    cellData
  };
}
