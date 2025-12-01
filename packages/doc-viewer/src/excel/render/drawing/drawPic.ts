import {Sheet} from '../../sheet/Sheet';
import {IPicture} from '../../types/IDrawing';
import {Rect, rectIntersect} from '../Rect';
import {SheetCanvas} from '../SheetCanvas';
import {PicRender} from './PicRender';

const PicRenderMap: Record<string, PicRender> = {};

export function drawPic(
  currentSheet: Sheet,
  canvas: SheetCanvas,
  displayRect: Rect,
  drawingRect: Rect,
  rowHeaderWidth: number,
  colHeaderHeight: number,
  pic: IPicture
) {
  if (!pic) {
    console.warn('pic do not exist');
    return;
  }
  const imgURL = pic.imgURL;
  if (!imgURL) {
    console.warn('imgURL do not exist');
    return;
  }

  // [comment removed]
  // const xfrm = pic.spPr?.xfrm;
  // if (!xfrm) {
  //   console.warn('xfrm do not exist');
  //   return;
  // }

  // const ext = xfrm.ext;
  // const off = xfrm.off;

  // if (!ext || !off) {
  //   console.warn('ext or off do not exist');
  //   return;
  // }

  // const x = emuToPx(parseFloat(off.x! as string));
  // const y = emuToPx(parseFloat(off.y! as string));
  // const width = emuToPx(ext.cx!);
  // const height = emuToPx(ext.cy!);

  const workbook = currentSheet.getWorkbook();
  // [comment removed]
  const dataContainer = workbook.getDataContainer();

  const renderRect = {
    x: drawingRect.x,
    y: drawingRect.y,
    width: drawingRect.width,
    height: drawingRect.height
  };

  // [comment removed]
  const relativeDisplayRect = {
    x: 0,
    y: 0,
    width: displayRect.width,
    height: displayRect.height
  };

  // [comment removed]
  if (rectIntersect(renderRect, relativeDisplayRect)) {
    const gid = pic.gid;
    // [comment removed]
    const gidElement = dataContainer.querySelector(`[data-gid="${gid}"]`);
    if (PicRenderMap[gid] && gidElement) {
      PicRenderMap[gid].updatePosition(renderRect);
      PicRenderMap[gid].show();
    } else {
      const picRender = new PicRender(dataContainer, renderRect, gid, pic);
      PicRenderMap[gid] = picRender;
    }
  } else {
    if (PicRenderMap[pic.gid]) {
      PicRenderMap[pic.gid].hide();
    }
  }
}
