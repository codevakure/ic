import {CT_CfRule} from '../../../openxml/ExcelTypes';
import {CellInfo} from '../../types/CellInfo';
import {Sheet} from '../Sheet';
import {applyDxf} from '../applyDxf';

/**
 */
export function applyCfRuleDxf(
  cfRule: CT_CfRule,
  sheet: Sheet,
  cellInfo: CellInfo
) {
  const dxfId = cfRule.dxfId || 0;
  const dataProvider = sheet.workbook.getDataProvider();

  const dxf = dataProvider.getDxf(dxfId);
  applyDxf(cellInfo, dxf);
}
