/**
 */

import {IDataProvider} from './types/IDataProvider';

export class StyleSheet {
  dataProvider: IDataProvider;

  constructor(dataProvider: IDataProvider) {
    this.dataProvider = dataProvider;
  }
}
