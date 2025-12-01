import {autoParse} from '../../../../common/autoParse';
import {CT_Picture_Attributes} from '../../../../openxml/ExcelTypes';
import {PackageParser} from '../../../../package/PackageParser';
import {joinPath} from '../../../../util/joinPath';
import {XMLNode} from '../../../../util/xml';
import {IRelationship} from '../../../types/IRelationship';
import {getRelationPath} from './getRelationPath';

let picId = 0;

export function parsePic(
  child: XMLNode,
  relationships: IRelationship[],
  parser: PackageParser,
  drawingPath: string
) {
  const pic = autoParse(child, CT_Picture_Attributes);
  const embedId = pic.blipFill?.blip?.['r:embed'];
  console.log('[parsePic] Processing:', { drawingPath, embedId, hasBlipFill: !!pic.blipFill });
  if (embedId) {
    const imagePath = getRelationPath(drawingPath, relationships, embedId);
    console.log('[parsePic] Image path resolved:', imagePath);
    if (imagePath) {
      const data = parser.getFileByType(imagePath, 'blob');
      console.log('[parsePic] Image data:', { imagePath, hasData: !!data, dataType: data?.constructor?.name });
      if (data && URL.createObjectURL) {
        pic.imgURL = URL.createObjectURL(data as Blob);
        pic.gid = `pic-${picId++}`;
        console.log('[parsePic] Image URL created:', pic.imgURL);
      } else {
        console.warn('[parsePic] Failed to create blob URL:', { hasData: !!data, hasCreateObjectURL: !!URL.createObjectURL });
      }
    } else {
      console.warn('[parsePic] Image path not found for embedId:', embedId);
    }
  } else {
    console.warn('[parsePic] No embed ID found in picture');
  }
  return pic;
}
