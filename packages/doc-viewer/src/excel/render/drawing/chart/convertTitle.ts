import {CT_Title} from '../../../../openxml/ChartTypes';

export function convertTitle(chartTitle?: CT_Title) {
  const title = {
    top: 0,
    right: 'center',
    text: ''
  } as {
    top?: string | number;
    right?: string | number;
    bottom?: string | number;
    left?: string | number;
    text: string;
  };

  if (chartTitle) {
    // [comment removed]
    for (const p of chartTitle.tx?.rich?.p || []) {
      for (const r of p.r || []) {
        title.text += r.t || '';
      }
    }

    if (chartTitle.layout) {
      // [comment removed]
      const manualLayout = chartTitle.layout.manualLayout;
      if (manualLayout) {
        if (manualLayout.x) {
          title.left = manualLayout.x.val;
        }
        if (manualLayout.y) {
          title.top = manualLayout.y.val;
        }
      }
    }
  }

  return title;
}
