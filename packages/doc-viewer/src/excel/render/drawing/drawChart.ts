import {Sheet} from '../../sheet/Sheet';
import {IChartSpace} from '../../types/IChartSpace';
import {Rect, rectIntersect} from '../Rect';
import {EChartsRender} from './EChartsRender';
import {convertToEChartOptions} from './convertToEChartOptions';

const EChartsMap: Record<string, EChartsRender> = {};

export function drawChart(
  currentSheet: Sheet,
  displayRect: Rect,
  rowHeaderWidth: number,
  colHeaderHeight: number,
  chartRect: Rect,
  chartSpace: IChartSpace
) {
  const workbook = currentSheet.getWorkbook();
  // [comment removed]
  const dataContainer = workbook.getDataContainer();
  const gid = chartSpace.gid;

  // [comment removed]
  const relativeDisplayRect = {
    x: 0,
    y: 0,
    width: displayRect.width,
    height: displayRect.height
  };

  const renderRect = {
    x: chartRect.x - rowHeaderWidth,
    y: chartRect.y - colHeaderHeight,
    width: chartRect.width,
    height: chartRect.height
  };

  if (rectIntersect(renderRect, relativeDisplayRect)) {
    let echartsRender;

    // [comment removed]
    const chartElement = dataContainer.querySelector(`[data-gid="${gid}"]`);

    if (EChartsMap[gid] && chartElement) {
      echartsRender = EChartsMap[gid];
      echartsRender.updatePosition(renderRect);
      echartsRender.show();
    } else {
      echartsRender = new EChartsRender(dataContainer, renderRect, gid);
      EChartsMap[gid] = echartsRender;
      const echartsOption = convertToEChartOptions(workbook, chartSpace);
      if (echartsOption) {
        echartsRender.render(echartsOption);
      }
    }
  } else {
    if (EChartsMap[gid]) {
      EChartsMap[gid].hide();
    }
  }
}
