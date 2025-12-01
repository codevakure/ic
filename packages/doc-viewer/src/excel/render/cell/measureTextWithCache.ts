/**
 */
const textSizeCache: Map<string, TextSize> = new Map();

export interface TextSize {
  /**
   */
  width: number;
  /**
   */
  boundingWidth: number;
  /**
   */
  height: number;
  /**
   */
  fontHeight: number;
}
/**
 */

export function measureTextWithCache(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  font: string,
  text: string
): TextSize {
  const key = `${font}---${text}`;
  if (textSizeCache.has(key)) {
    return textSizeCache.get(key)!;
  }
  ctx.font = font;
  const measureSize = ctx.measureText(text);
  const size = {
    width: measureSize.width,
    boundingWidth:
      Math.abs(measureSize.actualBoundingBoxRight) +
      Math.abs(measureSize.actualBoundingBoxLeft),
    height:
      measureSize.actualBoundingBoxAscent +
      measureSize.actualBoundingBoxDescent,
    fontHeight:
      measureSize.fontBoundingBoxAscent + measureSize.fontBoundingBoxDescent
  };
  textSizeCache.set(key, size);
  return size;
}

export function inValidTextSizeCache() {
  textSizeCache.clear();
}
