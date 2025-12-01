import {autoParse} from '../../../common/autoParse';
import {
  CT_WorkbookPr,
  CT_WorkbookPr_Attributes
} from '../../../openxml/ExcelTypes';
import {XMLNode, getNodeByTagName} from '../../../util/xml';

/**
 */
export function parseWorkbookPr(workbookNode: XMLNode): CT_WorkbookPr {
  const workbookPrNode = getNodeByTagName(workbookNode, 'workbookPr');
  return autoParse(workbookPrNode, CT_WorkbookPr_Attributes);
}
