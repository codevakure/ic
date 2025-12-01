import {CT_NumDataSource} from '../../../../openxml/ChartTypes';
import {Workbook} from '../../../Workbook';

/**
 */
export function getData(workbook: Workbook, val?: CT_NumDataSource) {
  const ref = val?.numRef?.f;
  if (!ref) {
    return [];
  }
  const seriesData = (val?.numRef?.numCache?.pt || []).map(pt => {
    return parseFloat(pt.v!);
  });
  return seriesData;
}
