import {RangeRef} from '../../types/RangeRef';

export type Reference = NameReference | CellReference;

export type NameReference = {
  sheetName?: string;
  name: string;
};

export type CellReference = {
  sheetName?: string;
  // [comment removed]
  start: string;
  end: string;
  range: RangeRef;
};
