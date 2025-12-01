import {BaseDrawingRender} from './BaseDrawingRender';
import {Rect} from '../Rect';

export class EChartsRender extends BaseDrawingRender {
  constructor(container: HTMLElement, displayRect: Rect, gid: string) {
    super(container, displayRect, gid, 'excel-chart');
  }

  render(option: any) {
    import('echarts').then(echarts => {
      // [comment removed]
      const chart = echarts.init(this.drawingContainer);
      chart.setOption(option);
    });
  }
}
