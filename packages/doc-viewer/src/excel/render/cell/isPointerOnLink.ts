import {pointInRect} from '../Rect';
import {LinkPosition} from './LinkPosition';

/**
 */
export function isPointerOnLink(
  x: number,
  y: number,
  linkPositionCache: LinkPosition[]
) {
  for (const linkPosition of linkPositionCache) {
    for (const pos of linkPosition.pos) {
      if (pointInRect(x, y, pos)) {
        return linkPosition.url;
      }
    }
  }

  return false;
}
