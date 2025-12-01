import {ST_SheetState} from '../../openxml/ExcelTypes';
import {Attributes} from '../../openxml/Attributes';
import {IWorksheet} from './IWorksheet';

/**
 */
export interface ISheet {
  'name': string;
  'sheetId': string;
  'state'?: ST_SheetState;
  'r:id': string;
  'worksheet'?: IWorksheet;
}

export const ISheet_Attributes: Attributes = {
  'name': {
    type: 'string'
  },
  'sheetId': {
    type: 'string'
  },
  'state': {
    type: 'string'
  },
  'r:id': {
    type: 'string'
  }
};
