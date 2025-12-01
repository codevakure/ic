import {autoParse} from '../../../common/autoParse';
import {CT_BookView, CT_BookView_Attributes} from '../../../openxml/ExcelTypes';
import {XMLNode, getNodeByTagName} from '../../../util/xml';

/**
 */
export function parseWorkbookView(workbookNode: XMLNode): CT_BookView {
  const workbookViewNode = getNodeByTagName(workbookNode, 'workbookView', true);
  return autoParse(workbookViewNode, CT_BookView_Attributes);
}
