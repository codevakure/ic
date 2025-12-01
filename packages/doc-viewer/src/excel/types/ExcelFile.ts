/**
 */

import {ContentTypes} from '../../openxml/ContentType';
import {IWorkbook} from './IWorkbook';

export interface ExcelFile {
  /**
   */
  contentTypes: ContentTypes;

  workbook: IWorkbook;
}
