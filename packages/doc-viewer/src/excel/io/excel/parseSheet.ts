/**
 */

import {XMLNode} from '../../../util/xml';
import {StringItem} from '../../types/StringItem';
import {ISheet, ISheet_Attributes} from '../../types/ISheet';
import {IWorkbook} from '../../types/IWorkbook';

import {PackageParser} from '../../../package/PackageParser';
import {parseWorksheet} from './parseWorksheet';
import {IWorksheet} from '../../types/IWorksheet';
import {parseRelationship} from '../../../common/parseRelationship';
import {IRelationship} from '../../types/IRelationship';
import {autoParse} from '../../../common/autoParse';
import {getRelPath} from './getRelPath';

export async function parseSheets(
  node: XMLNode,
  parser: PackageParser,
  workbook: IWorkbook,
  sharedStrings: StringItem[]
) {
  const sheets: ISheet[] = [];
  for (const sheetNode of node.children || []) {
    const sheet = autoParse(sheetNode, ISheet_Attributes) as ISheet;
    sheets.push(sheet);

    // [comment removed]
    const rId = sheet['r:id'];
    const state = sheet.state;
    const relationship = workbook.workbookRelationships?.find(
      relationship => relationship.id === rId
    );

    const target = relationship?.target;
    if (target) {
      // [comment removed]
      const worksheetPath = target.startsWith('/') ? target : `xl/${target}`;
      const sheetXML = parser.getString(worksheetPath);
      if (sheetXML) {
        const worksheetRelationPath = getRelPath(worksheetPath);
        let worksheetRelationships: IRelationship[] = [];
        if (parser.fileExists(worksheetRelationPath)) {
          worksheetRelationships = await parseRelationship(
            parser.getString(worksheetRelationPath)
          );
        }
        sheet.worksheet = (await parseWorksheet(
          workbook,
          parser,
          worksheetPath,
          sheetXML,
          worksheetRelationships,
          sharedStrings
        )) as IWorksheet;
      }
    }
  }
  return sheets;
}
