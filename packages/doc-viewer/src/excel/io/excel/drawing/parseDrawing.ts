import {autoParse} from '../../../../common/autoParse';
import {parseRelationship} from '../../../../common/parseRelationship';
import {
  CT_AbsoluteAnchor_Attributes,
  CT_OneCellAnchor_Attributes,
  CT_Picture_Attributes,
  CT_TwoCellAnchor_Attributes
} from '../../../../openxml/ExcelTypes';
import {PackageParser} from '../../../../package/PackageParser';
import {joinPath} from '../../../../util/joinPath';
import {parseXML, xml2json} from '../../../../util/xml';
import {IDrawing} from '../../../types/IDrawing';
import {IRelationship} from '../../../types/IRelationship';
import {IWorkbook} from '../../../types/IWorkbook';
import {getRelPath} from '../getRelPath';
import {parseAnchorCommon} from './parseAnchorCommon';

/**
 * P3155
 */
export async function parseDrawing(
  workbook: IWorkbook,
  parser: PackageParser,
  drawingPath: string
) {
  const drawing: IDrawing = {
    oneCellAnchors: [],
    twoCellAnchors: [],
    absoluteAnchors: []
  };
  const drawingXML = parser.getString(drawingPath);

  let relationships: IRelationship[] = [];

  const drawingRelationPath = getRelPath(drawingPath);

  if (parser.fileExists(drawingRelationPath)) {
    relationships = await parseRelationship(
      parser.getString(drawingRelationPath)
    );
  }

  const node = await xml2json(drawingXML);

  // [comment removed]
  const nodeElement = parseXML(drawingXML);

  const oneCellAnchorElements =
    nodeElement.getElementsByTagName('xdr:oneCellAnchor');

  const twoCellAnchorElements =
    nodeElement.getElementsByTagName('xdr:twoCellAnchor');

  const absoluteAnchorElements =
    nodeElement.getElementsByTagName('xdr:absoluteAnchor');

  for (const [index, drawingNode] of (node.children || []).entries()) {
    const childTag = drawingNode.tag;
    console.log('[parseDrawing] Processing tag:', childTag, 'full node:', drawingNode);
    switch (childTag) {
      case 'xdr:oneCellAnchor':
      case 'oneCellAnchor':
        const oneCellAnchor = autoParse(
          drawingNode,
          CT_OneCellAnchor_Attributes
        );

        const oneCellAnchorElement = oneCellAnchorElements[index];

        await parseAnchorCommon(
          workbook,
          parser,
          drawingPath,
          drawingNode,
          relationships,
          oneCellAnchor,
          oneCellAnchorElement
        );

        drawing.oneCellAnchors.push(oneCellAnchor);
        break;

      case 'xdr:twoCellAnchor':
      case 'twoCellAnchor':
        // [comment removed]
        const twoCellAnchor = autoParse(
          drawingNode,
          CT_TwoCellAnchor_Attributes
        );

        const twoCellAnchorElement = twoCellAnchorElements[index];

        await parseAnchorCommon(
          workbook,
          parser,
          drawingPath,
          drawingNode,
          relationships,
          twoCellAnchor,
          twoCellAnchorElement
        );
        drawing.twoCellAnchors.push(twoCellAnchor);
        break;

      case 'xdr:absoluteAnchor':
      case 'absoluteAnchor':
        const absoluteAnchor = autoParse(
          drawingNode,
          CT_AbsoluteAnchor_Attributes
        );
        const absoluteAnchorElement = absoluteAnchorElements[index];
        await parseAnchorCommon(
          workbook,
          parser,
          drawingPath,
          drawingNode,
          relationships,
          absoluteAnchor,
          absoluteAnchorElement
        );
        drawing.absoluteAnchors.push(absoluteAnchor);
        break;

      default:
        console.warn(`unhandled tag: ${childTag}`);
    }
  }

  return drawing;
}
