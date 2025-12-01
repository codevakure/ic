import {DataBarDisplay} from '../../types/DataBarDisplay';
import {Canvas} from '../Canvas';

/**
 */
export function drawCellDataBarX14(
  canvas: Canvas,
  dataBarDisplay: DataBarDisplay,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const fillColor = dataBarDisplay.color;
  if (fillColor !== 'none') {
    const xCenter = x + width / 2;
    // [comment removed]
    const axisColor = dataBarDisplay.axisColor;
    canvas.setLineDash(
      {
        x1: xCenter,
        y1: y,
        x2: xCenter,
        y2: y + height
      },
      [1, 1],
      axisColor
    );

    const displayWidth = Math.abs((width * dataBarDisplay.percent) / 2);
    if (displayWidth === 0) {
      return;
    }

    if (dataBarDisplay.percent < 0) {
      // [comment removed]
      if (dataBarDisplay.gradient) {
        let startColor = dataBarDisplay.negativeFillColorGradient;
        let endColor = dataBarDisplay.negativeFillColor;
        canvas.drawRectLinearGradientWithPadding(
          xCenter - displayWidth,
          y,
          displayWidth,
          height,
          startColor,
          endColor,
          1
        );
      }
      // [comment removed]
      if (dataBarDisplay.border && dataBarDisplay.negativeBorderColor) {
        canvas.drawStrokeRectPadding(
          xCenter - displayWidth,
          y,
          displayWidth,
          height,
          dataBarDisplay.negativeBorderColor,
          1
        );
      }
    } else {
      // [comment removed]
      if (dataBarDisplay.gradient) {
        let startColor = dataBarDisplay.color;
        let endColor = dataBarDisplay.colorGradient;
        canvas.drawRectLinearGradientWithPadding(
          xCenter,
          y,
          displayWidth,
          height,
          startColor,
          endColor,
          1
        );
      }

      // [comment removed]
      if (dataBarDisplay.border && dataBarDisplay.borderColor) {
        canvas.drawStrokeRectPadding(
          xCenter,
          y,
          displayWidth,
          height,
          dataBarDisplay.borderColor,
          1
        );
      }
    }
  }
}
