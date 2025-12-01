/**
 * @param xml
 */

import {autoParse} from '../../../common/autoParse';
import {CT_OfficeStyleSheet_Attributes} from '../../../openxml/DMLTypes';
import {xml2json} from '../../../util/xml';
import {CT_Theme} from '../../types/CT_Theme';

export async function parseTheme(xml: string): Promise<CT_Theme> {
  if (!xml) {
    throw new Error('xml is empty');
  }
  const node = await xml2json(xml);
  const theme = autoParse(node, CT_OfficeStyleSheet_Attributes, true);

  // [comment removed]
  const colorList: string[] = [];
  for (const key in theme?.themeElements?.clrScheme || {}) {
    // [comment removed]
    if (key === 'name') {
      continue;
    }
    const color = theme?.themeElements?.clrScheme[key];
    colorList.push(color);
  }

  if (theme.themeElements) {
    theme.themeElements.clrSchemes = colorList;
  }

  return theme;
}
