import {CT_Dxf} from '../../openxml/ExcelTypes';
import {CellInfo} from '../types/CellInfo';

/**
 */
export function applyDxf(cellInfo: Partial<CellInfo>, dxf?: CT_Dxf | null) {
  if (dxf) {
    if (dxf.font) {
      cellInfo.font = {
        ...cellInfo.font,
        ...dxf.font
      };
    }
    if (dxf.fill) {
      cellInfo.fill = {
        ...cellInfo.fill,
        ...dxf.fill
      };
    }
    if (dxf.border) {
      cellInfo.border = {
        ...cellInfo.border,
        ...dxf.border
      };
    }
  }
}
