import {parseChildrenAttributes} from '../../../common/parseAttributes';
import {CT_DefinedName_Attributes} from '../../../openxml/ExcelTypes';
import {XMLNode} from '../../../util/xml';

/**
 */
export function parseDefinedNames(node: XMLNode) {
  return parseChildrenAttributes(node, CT_DefinedName_Attributes);
}
