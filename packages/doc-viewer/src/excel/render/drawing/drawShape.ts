import {CT_CellAlignment} from '../../../openxml/ExcelTypes';
import {ShapeGuide} from '../../../openxml/drawing/Shape';
import {ShapePr} from '../../../openxml/drawing/ShapeProperties';
import {presetShape} from '../../../openxml/drawing/presetShape';
import {shapeToSVG} from '../../../openxml/drawing/svg/shapeToSVG';
import {emuToPx} from '../../../util/emuToPx';
import {Sheet} from '../../sheet/Sheet';
import {CellInfo} from '../../types/CellInfo';
import {IShape, IShapeProperties} from '../../types/IDrawing';
import {IRElt} from '../../types/IRElt';
import {ExcelRender} from '../ExcelRender';

import {Rect, rectIntersect} from '../Rect';
import {SheetCanvas} from '../SheetCanvas';
import {drawTextInCell} from '../cell/drawTextInCell';

function convertIShapePropertiesToShapePr(shapePr: IShapeProperties): ShapePr {
  let outline = shapePr.outline;
  let fillColor = shapePr.fillColor;
  let noFill: boolean | undefined = undefined;
  if (shapePr.noFill) {
    noFill = true;
  }
  return {
    outline,
    fillColor,
    noFill
  };
}

function convertTextBody(): IRElt[] {
  const r: IRElt[] = [];

  return r;
}

/**
 */
export async function drawShape(
  excelRender: ExcelRender,
  currentSheet: Sheet,
  canvas: SheetCanvas,
  displayRect: Rect,
  drawingRect: Rect,
  rowHeaderWidth: number,
  colHeaderHeight: number,
  sp: IShape
) {
  // const xfrm = sp.spPr?.xfrm;
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

  // [comment removed]
  const relativeDisplayRect = {
    x: 0,
    y: 0,
    width: displayRect.width,
    height: displayRect.height
  };

  const renderRect = {
    x: drawingRect.x - rowHeaderWidth,
    y: drawingRect.y - colHeaderHeight,
    width: drawingRect.width,
    height: drawingRect.height
  };

  // [comment removed]
  if (rectIntersect(renderRect, relativeDisplayRect)) {
    const workbook = currentSheet.getWorkbook();
    const dataProvider = workbook.getDataProvider();
    // [comment removed]
    const spPr = sp.spPr!;
    const prstGeom = spPr.prstGeom;

    // [comment removed]
    if (prstGeom && prstGeom.prst) {
      const prst = prstGeom.prst;
      const shape = presetShape[prst];

      if (shape) {
        const avLst: ShapeGuide[] = [];
        // [comment removed]
        for (const gd of prstGeom.avLst?.gd || []) {
          avLst.push({
            n: gd.name!,
            f: gd.fmla!
          });
        }
        // [comment removed]
        for (const gd of prstGeom.avLst?.gd || []) {
          avLst.push({
            n: gd.name!,
            f: gd.fmla!
          });
        }
        const svg = shapeToSVG(
          shape,
          avLst,
          convertIShapePropertiesToShapePr(spPr),
          drawingRect.width,
          drawingRect.height,
          {
            lineColor: sp.styleColor?.lnRefColor,
            fillColor: sp.styleColor?.fillRefColor,
            fontColor: sp.styleColor?.fontRefColor
          }
        );
        const svgContent = new XMLSerializer().serializeToString(svg);

        const svgURL = 'data:image/svg+xml;base64,' + btoa(svgContent);

        await canvas.drawImageWithCache(
          svgURL,
          drawingRect.x - displayRect.x,
          drawingRect.y - displayRect.y,
          drawingRect.width,
          drawingRect.height
        );
      }
    }

    const richText = sp.richText;

    if (richText) {
      let alignment: CT_CellAlignment = {};
      const anchor = sp.txBody?.bodyPr?.anchor;
      if (anchor) {
        switch (anchor) {
          case 't':
            alignment.vertical = 'top';
            break;

          case 'ctr':
            alignment.vertical = 'center';
            break;

          case 'b':
            alignment.vertical = 'bottom';
            break;

          default:
            break;
        }
      }

      // [comment removed]
      const cellInfo: CellInfo = {
        row: 0,
        col: 0,
        font: {},
        text: '',
        value: '',
        alignment,
        cellData: richText
      };
      drawTextInCell(
        excelRender,
        currentSheet,
        canvas.getContext(),
        dataProvider,
        cellInfo,
        drawingRect.x - displayRect.x,
        drawingRect.y - displayRect.y,
        drawingRect.width,
        drawingRect.height,
        0,
        0
      );
    }
  }
}
