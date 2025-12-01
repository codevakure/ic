import {parseXML, xml2json} from '../../../util/xml';
import {IWorksheet} from '../../types/IWorksheet';

import {StringItem} from '../../types/StringItem';
import {parseChildrenAttributes} from '../../../common/parseAttributes';

import {parseSheetData} from './worksheet/parseSheetData';
import {
  CT_AutoFilter_Attributes,
  CT_Col_Attributes,
  CT_ConditionalFormatting_Attributes,
  CT_SheetFormatPr_Attributes,
  CT_SheetPr_Attributes,
  CT_SheetView_Attributes
} from '../../../openxml/ExcelTypes';
import {decodeAddress} from './util/decodeAddress';
import {IRelationship} from '../../types/IRelationship';
import {PackageParser} from '../../../package/PackageParser';
import {joinPath} from '../../../util/joinPath';
import {parseDrawing} from './drawing/parseDrawing';
import {autoParse} from '../../../common/autoParse';
import {CT_ExtensionList_Attributes} from '../../types/CT_ExtensionList';
import {initValueForContainsBlanks} from './initValueForContainsBlanks';
import {parseTableParts} from './parseTableParts';
import {initValueForTable} from './initValueForTable';
import {IWorkbook} from '../../types/IWorkbook';
import {xmlToNode} from '../../../util/xmlToNode';

/**
 */
export async function parseWorksheet(
  workbook: IWorkbook,
  parser: PackageParser,
  worksheetPath: string,
  xml: string,
  relationships: IRelationship[],
  sharedStrings: StringItem[]
) {
  if (!xml) {
    return null;
  }

  const node = await xml2json(xml);

  const worksheet: IWorksheet = {
    cols: [],
    rows: [],
    cellData: [],
    mergeCells: [],
    conditionalFormatting: []
  };
  for (const child of node.children) {
    const tag = child.tag;
    switch (tag) {
      case 'dimension':
        worksheet.dimension = {
          ref: child.attrs.ref
        };
        break;

      case 'sheetViews':
        worksheet.sheetViews = parseChildrenAttributes(
          child,
          CT_SheetView_Attributes,
          true
        );
        break;

      case 'sheetFormatPr':
        worksheet.sheetFormatPr = autoParse(child, CT_SheetFormatPr_Attributes);
        break;

      case 'cols':
        const cols = parseChildrenAttributes(child, CT_Col_Attributes);
        // [comment removed]
        for (const col of cols) {
          col.min = (col.min || 1) - 1;
          col.max = (col.max || 1) - 1;
        }
        worksheet.cols = cols;
        break;

      case 'sheetData':
        const sheetData = parseSheetData(child, sharedStrings);
        worksheet.rows = sheetData.rows;
        worksheet.cellData = sheetData.cellData;
        break;

      case 'mergeCells':
        const mergeCellNodes = child.children || [];
        for (const mergeCellNode of mergeCellNodes) {
          const ref = mergeCellNode.attrs?.ref;
          if (ref) {
            const refs = ref.split(':');
            if (refs.length === 2) {
              const startIndex = decodeAddress(refs[0]);
              const endIndex = decodeAddress(refs[1]);
              worksheet.mergeCells.push({
                startCol: startIndex.col,
                startRow: startIndex.row,
                endCol: endIndex.col,
                endRow: endIndex.row
              });
            } else {
              console.warn('error ref', ref);
            }
          }
        }
        break;

      case 'conditionalFormatting':
        const conditionalFormatting = autoParse(
          child,
          CT_ConditionalFormatting_Attributes
        );
        worksheet.conditionalFormatting.push(conditionalFormatting);
        break;

      case 'drawing':
        console.log('[parseWorksheet] Found drawing element:', child.attrs);
        const rId = child.attrs['r:id'];
        console.log('[parseWorksheet] Drawing rId:', rId);
        const relationship = relationships.find(
          relationship => relationship.id === rId
        );
        console.log('[parseWorksheet] Found relationship:', relationship);
        if (relationship) {
          const target = relationship.target;
          // Handle both relative (../drawings/drawing1.xml) and absolute (xl/drawings/drawing1.xml) paths
          let path: string;
          if (target.startsWith('xl/') || target.startsWith('/xl/')) {
            // Absolute path
            path = target.replace(/^\//, '');
          } else {
            // Relative path - resolve from worksheet directory
            // worksheetPath is like 'xl/worksheets/sheet1.xml'
            // target is like '../drawings/drawing1.xml'
            const worksheetDir = worksheetPath.substring(0, worksheetPath.lastIndexOf('/'));
            path = joinPath(worksheetDir, target);
          }
          console.log('[parseWorksheet] Drawing path:', { worksheetPath, target, resolved: path });
          worksheet.drawing = await parseDrawing(workbook, parser, path);
        }
        break;

      case 'phoneticPr':
      case 'pageMargins':
        // [comment removed]
        break;

      case 'extLst':
        worksheet.extLst = autoParse(child, CT_ExtensionList_Attributes);
        break;

      case 'tableParts':
        worksheet.tableParts = await parseTableParts(
          worksheetPath,
          parser,
          relationships,
          child
        );
        break;

      case 'autoFilter':
        worksheet.autoFilter = autoParse(child, CT_AutoFilter_Attributes);
        break;

      case 'sheetPr':
        worksheet.sheetPr = autoParse(child, CT_SheetPr_Attributes);
        break;

      default:
        console.warn('unknown tag', tag);
        break;
    }
  }

  initValueForContainsBlanks(worksheet);
  initValueForTable(worksheet);

  return worksheet;
}
