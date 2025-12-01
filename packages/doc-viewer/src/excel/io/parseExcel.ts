/**
 */

import {PackageParser} from '../../package/PackageParser';
import {ExcelFile} from '../types/ExcelFile';
import {parseWorkbook} from './excel/parseWorkbook';
import {parseContentType} from '../../common/parseContentType';
import {xml2json} from '../../util/xml';

import {CT_Stylesheet_Attributes} from '../../openxml/ExcelTypes';
import {autoParse} from '../../common/autoParse';

/**
 * @param parser
 */
export async function parseExcel(parser: PackageParser): Promise<ExcelFile> {
  const contentTypes = await parseContentType(parser);

  const styleSheetNode = await xml2json(parser.getString('xl/styles.xml'));
  const styleSheet = autoParse(styleSheetNode, CT_Stylesheet_Attributes);

  const workbook = await parseWorkbook(parser, styleSheet);
  return {
    contentTypes,
    workbook
  };
}
