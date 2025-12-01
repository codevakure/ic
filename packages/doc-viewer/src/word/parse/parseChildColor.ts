import {getAttrPercent, getVal} from '../../OpenXML';
import {Color} from '../../util/color';
import Word from '../../Word';
import {PresetColorMap} from '../../openxml/colorNameMap';
import {modifyColor} from './modifyColor';

/**
 */
export function parseChildColor(
  getThemeColor: (c: string) => string,
  element: Element
): string {
  const colorChild = element.firstElementChild;
  if (colorChild) {
    const colorType = colorChild.tagName;
    switch (colorType) {
      case 'a:prstClr':
        const color = getVal(colorChild) || '';
        if (color in PresetColorMap) {
          return modifyColor(
            colorChild,
            PresetColorMap[color as keyof typeof PresetColorMap]
          );
        } else {
          console.warn('parseOutline: Unknown color ', color, colorChild);
        }
        break;

      case 'a:srgbClr':
      case 'a:scrgbClr':
      case 'w14:srgbClr':
        const rgbColor = getVal(colorChild);
        if (rgbColor) {
          return modifyColor(colorChild, '#' + rgbColor);
        }
        const r = getAttrPercent(colorChild, 'r');
        const g = getAttrPercent(colorChild, 'g');
        const b = getAttrPercent(colorChild, 'b');
        const scrgbColor = Color.fromRGB(r, g, b);
        return modifyColor(colorChild, scrgbColor.toHex());

      case 'a:hslClr':
        const h = getAttrPercent(colorChild, 'r');
        const s = getAttrPercent(colorChild, 'g');
        const l = getAttrPercent(colorChild, 'b');
        const val = getVal(colorChild);
        // [comment removed]
        if (val) {
          return modifyColor(colorChild, '#' + val);
        }
        const hslColor = Color.fromHSL(h, s, l);
        return modifyColor(colorChild, hslColor.toHex());

      case 'a:schemeClr':
      case 'w14:schemeClr':
        const schemeClr = getVal(colorChild);
        if (schemeClr) {
          return modifyColor(colorChild, getThemeColor(schemeClr));
        } else {
          console.warn('parseOutline: Unknown schemeClr ', colorChild);
        }
        break;

      case 'a:sysClr':
        // [comment removed]
        return getVal(colorChild);

      default:
        console.warn(
          'parseOutline: Unknown color type ',
          colorType,
          colorChild
        );
    }
  }
  return '';
}
