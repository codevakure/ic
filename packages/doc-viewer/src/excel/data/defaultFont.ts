import {CT_Font, ST_FontScheme} from '../../openxml/ExcelTypes';
import {DEFAULT_FONT_SIZE} from '../render/Consts';

/**
 */

export default {
  name: {
    val: 'Calibri'
  },
  charset: {
    val: 134
  },
  family: {
    val: 2
  },
  color: {
    theme: 1
  },
  sz: {
    val: DEFAULT_FONT_SIZE
  },
  scheme: {
    val: 'minor' as ST_FontScheme
  }
};
