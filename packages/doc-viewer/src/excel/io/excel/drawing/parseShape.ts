import {autoParse} from '../../../../common/autoParse';
import {CT_Shape_Attributes} from '../../../../openxml/ExcelTypes';
import {parseOutline} from '../../../../openxml/drawing/ShapeProperties';
import {XMLNode} from '../../../../util/xml';
import {parseChildColor} from '../../../../word/parse/parseChildColor';
import {getThemeColor} from '../../../data/getThemeColor';
import {IShape, StyleColor} from '../../../types/IDrawing';
import {IRElt} from '../../../types/IRElt';
import {IRPrElt} from '../../../types/IRPrElt';
import {IWorkbook} from '../../../types/IWorkbook';

export function parseShape(
  workbook: IWorkbook,
  child: XMLNode,
  twoCellAnchorElement: Element
) {
  const shape = autoParse(child, CT_Shape_Attributes) as IShape;
  // [comment removed]
  if (twoCellAnchorElement) {
    const spPrs = twoCellAnchorElement.getElementsByTagName('xdr:spPr');
    if (spPrs.length && shape.spPr) {
      const spPr = spPrs[0];
      for (let i = 0; i < (spPr.children || []).length; i++) {
        const spPrChild = (spPr.children || [])[i] as Element;
        const tag = spPrChild.tagName;
        switch (tag) {
          case 'a:ln':
            const outline = parseOutline(c => {
              return getThemeColor(c, workbook);
            }, spPrChild);
            shape.spPr.outline = outline;
            break;
          case 'a:solidFill':
            shape.spPr.fillColor = parseChildColor(c => {
              return getThemeColor(c, workbook);
            }, spPrChild);
            break;

          default:
            break;
        }
      }
    }

    const style = twoCellAnchorElement.getElementsByTagName('xdr:style');
    if (style.length) {
      const styleColor: StyleColor = {};
      shape.styleColor = styleColor;
      for (let i = 0; i < (style[0].children || []).length; i++) {
        const styleChild = (style[0].children || [])[i] as Element;
        const tagName = styleChild.tagName;
        switch (tagName) {
          case 'a:lnRef':
            styleColor.lnRefColor = parseChildColor(c => {
              return getThemeColor(c, workbook);
            }, styleChild);
            break;
          case 'a:fillRef':
            styleColor.fillRefColor = parseChildColor(c => {
              return getThemeColor(c, workbook);
            }, styleChild);
            break;
          case 'a:effectRef':
            styleColor.effectRefColor = parseChildColor(c => {
              return getThemeColor(c, workbook);
            }, styleChild);
            break;
          case 'a:fontRef':
            styleColor.fontRefColor = parseChildColor(c => {
              return getThemeColor(c, workbook);
            }, styleChild);
            break;

          default:
            break;
        }
      }
    }

    const txBodies = twoCellAnchorElement.getElementsByTagName('xdr:txBody');
    if (txBodies.length) {
      const txBody = txBodies[0];
      const ts: IRElt[] = [];
      // [comment removed]
      const ps = txBody.getElementsByTagName('a:p');
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const rs = p.getElementsByTagName('a:r');
        for (let j = 0; j < rs.length; j++) {
          const r = rs[j];
          const t = r.getElementsByTagName('a:t');
          if (t.length) {
            const rPrNodes = r.getElementsByTagName('a:rPr');
            let rPr: IRPrElt = {};
            if (rPrNodes.length) {
              const rPrNode = rPrNodes[0];
              const sz = rPrNode.getAttribute('sz');
              if (sz) {
                // [comment removed]
                rPr.sz = parseInt(sz, 10) / 100;
              }

              const b = rPrNode.getAttribute('b');
              if (b) {
                rPr.b = true;
              }

              const solidFill = rPrNode.getElementsByTagName('a:solidFill');

              if (solidFill.length) {
                rPr.color = {
                  rgb: parseChildColor(c => {
                    return getThemeColor(c, workbook);
                  }, solidFill[0])
                };
              }
            }

            const text = t[0].textContent;
            if (text) {
              ts.push({
                rPr,
                t: text
              });
            }
          }
        }
      }

      shape.richText = {
        type: 'rich',
        richText: ts
      };
    }
  }

  return shape;
}
