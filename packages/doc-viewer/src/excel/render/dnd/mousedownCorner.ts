import {Workbook} from '../../Workbook';
import {selectAll} from './selectAll';

/**
 * @param workbook
 * @param hitTestResult
 * @returns
 */
export function mousedownCorner(workbook: Workbook) {
  return selectAll(workbook.getActiveSheet().getIndex());
}
