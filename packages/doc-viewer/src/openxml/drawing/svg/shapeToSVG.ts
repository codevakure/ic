/**
 *
 * https://wiki.documentfoundation.org/Development/Improve_handles_of_DrawingML_shapes
 */

import {Color} from '../../../util/color';
import {createSVGElement} from '../../../util/dom';
import {WPSStyle} from '../../word/wps/WPSStyle';
import {CustomGeom} from '../CustomGeom';
import {Geom} from '../Geom';
import {Shape, ShapeGuide} from '../Shape';
import {OutLine, ShapePr} from '../ShapeProperties';
import {Transform} from '../Transform';
import {evalFmla} from './formulas';
import {Point, Var, generateDefines} from './generateDefines';
import {presetVal} from './presetVal';

/**
 */
type CommonShapePr = {
  // [comment removed]
  outline?: OutLine;

  // [comment removed]
  fillColor?: string;

  // [comment removed]
  noFill?: boolean;
};

export function shapeToSVG(
  shape: Shape,
  avLst: ShapeGuide[],
  shapePr: CommonShapePr,
  width: number,
  height: number,
  wpsStyle?: WPSStyle
): SVGElement {
  const svg = createSVGElement('svg');
  svg.style.display = 'block';

  // [comment removed]
  // [comment removed]
  // [comment removed]
  svg.setAttribute(
    'style',
    'display: block; overflow: visible; position: absolute; z-index: -1'
  );
  svg.setAttribute('width', width.toString() + 'px');
  svg.setAttribute('height', height.toString() + 'px');

  // [comment removed]
  const vars: Var = presetVal(width, height);

  // [comment removed]
  for (const gd of shape.avLst || []) {
    evalFmla(gd.n, gd.f, vars);
  }

  // Custom avLst
  for (const gd of avLst) {
    evalFmla(gd.n, gd.f, vars);
  }

  // [comment removed]
  for (const gd of shape.gdLst || []) {
    evalFmla(gd.n, gd.f, vars);
  }

  const outline = shapePr.outline;
  const prevPoint: Point[] = [];
  for (const path of shape.pathLst || []) {
    const pathEl = createSVGElement('path');
    const d = generateDefines(path, vars, prevPoint);
    pathEl.setAttribute('d', d);

    if (shapePr.fillColor) {
      pathEl.setAttribute('fill', shapePr.fillColor);
    } else if (wpsStyle && wpsStyle.fillColor) {
      pathEl.setAttribute('fill', wpsStyle.fillColor);
    } else {
      pathEl.setAttribute('fill', 'none');
    }

    if (outline) {
      if (outline.color) {
        pathEl.setAttribute('stroke', outline.color);
      }
      if (outline.width) {
        pathEl.setAttribute('stroke-width', outline.width);
      }
      if (outline.style === 'none') {
        pathEl.setAttribute('stroke', 'none');
      }
    } else if (wpsStyle && wpsStyle.lineColor) {
      pathEl.setAttribute('stroke', wpsStyle.lineColor);
    } else {
      pathEl.setAttribute('stroke', 'none');
    }

    const fillColor = pathEl.getAttribute('fill');
    if (fillColor && fillColor !== 'none') {
      const color = new Color(fillColor);
      const fillMode = path.fill;
      let changeColor = '';
      switch (fillMode) {
        // [comment removed]
        // http://webapp.docx4java.org/OnlineDemo/ecma376/DrawingML/ST_PathFillMode.html
        case 'darken':
          changeColor = color.lumOff(-0.5).toHex();
          break;

        case 'darkenLess':
          changeColor = color.lumOff(-0.2).toHex();
          break;

        case 'lighten':
          changeColor = color.lumOff(0.5).toHex();
          break;

        case 'lightenLess':
          changeColor = color.lumOff(0.2).toHex();
          break;
      }
      if (changeColor) {
        pathEl.setAttribute('fill', changeColor);
      }
    }
    if (path.fill === 'none') {
      pathEl.setAttribute('fill', 'none');
    }

    if (path.stroke === false) {
      pathEl.setAttribute('stroke', 'none');
      if (!path.fill) {
        pathEl.setAttribute('fill', 'none');
      }
    }

    if (shapePr.noFill) {
      pathEl.setAttribute('fill', 'none');
    }

    svg.appendChild(pathEl);
  }

  return svg;
}
