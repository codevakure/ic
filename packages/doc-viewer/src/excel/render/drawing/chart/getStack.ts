import {CT_BarGrouping} from '../../../../openxml/ChartTypes';

export function getStack(grouping?: CT_BarGrouping) {
  let stack;
  let isPercentStacked = false;
  if (grouping) {
    if (grouping.val === 'stacked') {
      stack = 'x';
    }
    if (grouping.val === 'percentStacked') {
      // [comment removed]
      stack = 'x';
      isPercentStacked = true;
    }
  }
  return {stack, isPercentStacked};
}
