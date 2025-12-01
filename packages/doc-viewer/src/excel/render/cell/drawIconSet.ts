import {IconNames, presetIcons} from '../../io/excel/preset/presetIcons';

import {Canvas} from '../Canvas';

export function drawIconSet(
  canvas: Canvas,
  icon: IconNames,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const iconURL = presetIcons[icon];
  if (!iconURL) {
    console.warn('Unknown icon', icon);
    return;
  }

  // [comment removed]
  canvas.drawImageWithCache(iconURL, x + 1, y + 1, height - 2, height - 2);
}
