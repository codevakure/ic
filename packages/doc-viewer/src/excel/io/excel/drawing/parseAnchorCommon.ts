import {PackageParser} from '../../../../package/PackageParser';
import {XMLNode, getNodeByTagName, xml2json} from '../../../../util/xml';
import {IAnchorCommon} from '../../../types/IDrawing';
import {IRelationship} from '../../../types/IRelationship';
import {IWorkbook} from '../../../types/IWorkbook';
import {getRelationPath} from './getRelationPath';
import {parseChart} from './parseChart';
import {parsePic} from './parsePic';
import {parseShape} from './parseShape';

/**
 */
export async function parseAnchorCommon(
  workbook: IWorkbook,
  parser: PackageParser,
  drawingPath: string,
  drawingNode: XMLNode,
  relationships: IRelationship[],
  anchorCommon: IAnchorCommon,
  element: Element
) {
  for (const child of drawingNode.children || []) {
    const tag = child.tag;
    console.log('[parseAnchorCommon] Processing child tag:', tag);
    switch (tag) {
      case 'xdr:pic':
      case 'pic':
        console.log('[parseAnchorCommon] Found pic, parsing...');
        anchorCommon.pic = parsePic(child, relationships, parser, drawingPath);
        break;

      case 'xdr:sp':
      case 'sp':
        anchorCommon.shape = parseShape(workbook, child, element);
        break;

      case 'xdr:from':
      case 'from':
      case 'xdr:to':
      case 'to':
      case 'xdr:clientData':
      case 'clientData':
      case 'xdr:ext':
      case 'ext':
        // [comment removed]
        break;

      case 'xdr:graphicFrame':
      case 'graphicFrame':
        // [comment removed]
        const chartNode = getNodeByTagName(child, 'c:chart', true);
        if (chartNode) {
          const chartPath = getRelationPath(
            drawingPath,
            relationships,
            chartNode.attrs['r:id']
          );
          if (chartPath) {
            const chartXML = await xml2json(parser.getString(chartPath));
            anchorCommon.chartSpace = parseChart(chartXML);
          }
        }
        break;

      default:
        console.warn(`unhandled tag: ${tag}`);
    }
  }
}
